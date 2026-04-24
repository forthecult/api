import "server-only";

import type { ReactElement } from "react";

import { createId } from "@paralleldrive/cuid2";
import { render } from "@react-email/render";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { emailEventTable } from "~/db/schema";
import { captureServerEvent } from "~/lib/analytics/posthog-server";
import {
  resolveUserIdByEmail,
  userWantsMarketingEmail,
  userWantsTransactionalEmail,
} from "~/lib/email/consent";
import {
  deriveEmailIdempotencyKey,
  emailContentFingerprint,
} from "~/lib/email/email-idempotency";
import {
  bypassesConsentGate,
  type EmailSendKind,
  isMarketingEmailKind,
} from "~/lib/email/email-send-kind";
import {
  getResendClient,
  getResendFromAddress,
} from "~/lib/email/resend-client";
import { getSuppressionReason } from "~/lib/email/suppression";
import {
  buildUnsubscribeUrl,
  type UnsubscribeCategory,
} from "~/lib/email/unsubscribe-token";

export interface SendEmailParams {
  correlationId?: string;
  internal?: boolean;
  kind: EmailSendKind;
  react: ReactElement;
  replyTo?: string;
  subject: string;
  to: string;
}

export type SendEmailResult =
  | { emailEventId: string; ok: false; reason: string }
  | { emailEventId: string; ok: true; resendId: string }
  | { ok: false; reason: "consent" | "suppressed"; skipped: true }
  | { ok: false; reason: "invalid_to"; skipped: true }
  | { ok: false; reason: "missing_api_key"; skipped: true };

/**
 * Renders React Email, enforces consent + suppression, logs `email_event`, sends via Resend with idempotency + retry.
 */
export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  const { correlationId, internal, kind, react, replyTo, subject, to } = params;
  const toNorm = to.trim().toLowerCase();
  if (!toNorm) {
    return { ok: false, reason: "invalid_to", skipped: true };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[sendEmail] skip (no RESEND_API_KEY) kind=${kind} to=${toNorm} subject=${subject}`,
      );
      return { ok: false, reason: "missing_api_key", skipped: true };
    }
    throw new Error("RESEND_API_KEY is required in production to send email");
  }

  const html = await render(react, { pretty: false });
  const text = await render(react, { plainText: true });
  const fp = emailContentFingerprint(html, text);
  const idem = deriveEmailIdempotencyKey(
    kind,
    toNorm,
    subject,
    correlationId,
    fp,
  );

  const userId = await resolveUserIdByEmail(toNorm);

  if (!internal) {
    const suppression = await getSuppressionReason(toNorm);
    if (suppression === "bounced_hard" || suppression === "complaint") {
      await logEmailEvent({
        correlationId: correlationId ?? null,
        errorMessage: `suppressed:${suppression}`,
        kind,
        resendId: null,
        status: "suppressed_bounce",
        subject,
        toEmail: toNorm,
        userId,
      });
      captureServerEvent(
        userId ?? `anon:${fp.slice(0, 12)}`,
        "email_suppressed",
        {
          kind,
          reason: suppression,
        },
      );
      return { ok: false, reason: "suppressed", skipped: true };
    }
    if (suppression === "unsubscribed" && isMarketingEmailKind(kind)) {
      await logEmailEvent({
        correlationId: correlationId ?? null,
        errorMessage: "suppressed:unsubscribed",
        kind,
        resendId: null,
        status: "suppressed_consent",
        subject,
        toEmail: toNorm,
        userId,
      });
      captureServerEvent(
        userId ?? `anon:${fp.slice(0, 12)}`,
        "email_suppressed",
        {
          kind,
          reason: "unsubscribed",
        },
      );
      return { ok: false, reason: "suppressed", skipped: true };
    }
  }

  if (!internal && !bypassesConsentGate(kind)) {
    if (isMarketingEmailKind(kind)) {
      const wants = await userWantsMarketingEmail(userId);
      if (!wants) {
        await logEmailEvent({
          correlationId: correlationId ?? null,
          errorMessage: "marketing_email_disabled",
          kind,
          resendId: null,
          status: "suppressed_consent",
          subject,
          toEmail: toNorm,
          userId,
        });
        captureServerEvent(userId ?? toNorm, "email_suppressed", {
          kind,
          reason: "marketing_opt_out",
        });
        return { ok: false, reason: "consent", skipped: true };
      }
    } else {
      const wants = await userWantsTransactionalEmail(userId);
      if (!wants) {
        await logEmailEvent({
          correlationId: correlationId ?? null,
          errorMessage: "transactional_email_disabled",
          kind,
          resendId: null,
          status: "suppressed_consent",
          subject,
          toEmail: toNorm,
          userId,
        });
        captureServerEvent(userId ?? toNorm, "email_suppressed", {
          kind,
          reason: "transactional_opt_out",
        });
        return { ok: false, reason: "consent", skipped: true };
      }
    }
  }

  const eventId = createId();
  await db.insert(emailEventTable).values({
    correlationId: correlationId ?? null,
    createdAt: new Date(),
    errorMessage: null,
    id: eventId,
    kind,
    metadata: null,
    resendId: null,
    status: "queued",
    subject,
    toEmail: toNorm,
    updatedAt: new Date(),
    userId,
  });

  const headers = listUnsubscribeHeaders(kind, toNorm, internal);
  const from = getResendFromAddress();
  const resend = getResendClient();

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await resend.emails.send(
        {
          from,
          headers,
          html,
          replyTo: replyTo?.trim() || undefined,
          subject,
          text,
          to: toNorm,
        },
        { idempotencyKey: idem },
      );
      if (error) {
        lastErr = error;
        const retryable =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as { statusCode?: number }).statusCode === "number" &&
          [429, 500, 502, 503].includes(
            (error as { statusCode: number }).statusCode,
          );
        if (retryable && attempt < 2) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        await db
          .update(emailEventTable)
          .set({
            errorMessage: JSON.stringify(error),
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(emailEventTable.id, eventId));
        captureServerEvent(userId ?? toNorm, "email_send_failed", {
          kind,
          subject,
        });
        return { emailEventId: eventId, ok: false, reason: "resend_error" };
      }
      const resendId = data?.id ?? "";
      await db
        .update(emailEventTable)
        .set({
          resendId: resendId || null,
          status: "sent",
          updatedAt: new Date(),
        })
        .where(eq(emailEventTable.id, eventId));
      captureServerEvent(userId ?? toNorm, "email_sent", {
        email_event_id: eventId,
        kind,
        resend_id: resendId,
        subject,
      });
      return { emailEventId: eventId, ok: true, resendId };
    } catch (err) {
      lastErr = err;
      if (attempt < 2 && isRetryableResendError(err)) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      await db
        .update(emailEventTable)
        .set({
          errorMessage: err instanceof Error ? err.message : String(err),
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(emailEventTable.id, eventId));
      captureServerEvent(userId ?? toNorm, "email_send_failed", {
        kind,
        subject,
      });
      return { emailEventId: eventId, ok: false, reason: "resend_error" };
    }
  }

  await db
    .update(emailEventTable)
    .set({
      errorMessage:
        lastErr instanceof Error
          ? lastErr.message
          : String(lastErr ?? "unknown"),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(eq(emailEventTable.id, eventId));
  return { emailEventId: eventId, ok: false, reason: "resend_error" };
}

function defaultUnsubscribeMailto(): string {
  const raw =
    process.env.EMAIL_UNSUBSCRIBE_MAILTO?.trim() ||
    process.env.CONTACT_TO_EMAIL?.trim();
  if (raw?.startsWith("mailto:")) return raw;
  if (raw?.includes("@")) return `mailto:${raw}`;
  return "mailto:support@forthecult.store?subject=Unsubscribe";
}

function isRetryableResendError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|rate_limit|503|502|500|timeout/i.test(msg)) return true;
  return false;
}

function listUnsubscribeHeaders(
  kind: EmailSendKind,
  to: string,
  internal: boolean | undefined,
): Record<string, string> {
  if (internal) return {};
  const mailto = defaultUnsubscribeMailto();
  if (isMarketingEmailKind(kind)) {
    const category: UnsubscribeCategory =
      kind === "newsletter_welcome_discount" ? "newsletter" : "marketing";
    const httpsUrl = buildUnsubscribeUrl(to, category);
    return {
      "List-Unsubscribe": `<${mailto}>, <${httpsUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  return {
    "List-Unsubscribe": `<${mailto}>`,
  };
}

async function logEmailEvent(row: {
  correlationId: null | string;
  errorMessage: null | string;
  kind: EmailSendKind;
  resendId: null | string;
  status: string;
  subject: string;
  toEmail: string;
  userId: null | string;
}): Promise<void> {
  const id = createId();
  await db.insert(emailEventTable).values({
    correlationId: row.correlationId,
    createdAt: new Date(),
    errorMessage: row.errorMessage,
    id,
    kind: row.kind,
    metadata: null,
    resendId: row.resendId,
    status: row.status,
    subject: row.subject,
    toEmail: row.toEmail,
    updatedAt: new Date(),
    userId: row.userId,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
