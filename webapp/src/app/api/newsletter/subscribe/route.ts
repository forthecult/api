import { type NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createElement } from "react";

import { db } from "~/db";
import { newsletterSubscriberTable } from "~/db/schema";
import { NewsletterConfirmEmail } from "~/emails/newsletter-confirm";
import {
  publicApiCorsPreflight,
  withPublicApiCors,
} from "~/lib/cors-public-api";
import { sendEmail } from "~/lib/email/send-email";
import { isRealEmail } from "~/lib/is-real-email";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";
import { eq } from "drizzle-orm";

interface SubscribeBody {
  email?: string;
}

export async function OPTIONS() {
  return publicApiCorsPreflight();
}

/**
 * POST /api/newsletter/subscribe
 * Subscribe an email to the newsletter.
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`newsletter:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const body = (await request.json()) as SubscribeBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return withPublicApiCors(
        NextResponse.json({ error: "Email is required" }, { status: 400 }),
      );
    }

    if (!isRealEmail(email)) {
      return withPublicApiCors(
        NextResponse.json({ error: "Invalid email address" }, { status: 400 }),
      );
    }

    const now = new Date();
    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    const confirmUrl = `${getPublicSiteUrl().replace(/\/$/, "")}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
    const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
    const source = "api/newsletter/subscribe";

    const existing = await db
      .select({
        email: newsletterSubscriberTable.email,
        status: newsletterSubscriberTable.status,
      })
      .from(newsletterSubscriberTable)
      .where(eq(newsletterSubscriberTable.email, email))
      .limit(1);

    const existingRow = existing[0];
    if (existingRow?.status === "confirmed") {
      return withPublicApiCors(
        NextResponse.json({
          message: "You're already subscribed.",
          success: true,
        }),
      );
    }

    if (existingRow) {
      await db
        .update(newsletterSubscriberTable)
        .set({
          confirmationTokenHash: tokenHash,
          ipAtSignup: ip === "unknown" ? null : ip,
          source,
          status: "pending",
          unsubscribedAt: null,
          updatedAt: now,
          userAgentAtSignup: userAgent,
        })
        .where(eq(newsletterSubscriberTable.email, email));
    } else {
      await db.insert(newsletterSubscriberTable).values({
        confirmationTokenHash: tokenHash,
        consentedAt: null,
        createdAt: now,
        email,
        ipAtSignup: ip === "unknown" ? null : ip,
        resendContactId: null,
        source,
        status: "pending",
        unsubscribedAt: null,
        updatedAt: now,
        userAgentAtSignup: userAgent,
      });
    }

    const subject = "Confirm your newsletter subscription";
    const sendResult = await sendEmail({
      kind: "newsletter_confirm",
      metadata: {
        campaign_id: "newsletter_confirm",
        source,
        utm_campaign: "newsletter_confirm",
        utm_content: "double_opt_in",
      },
      react: createElement(NewsletterConfirmEmail, { confirmUrl }),
      subject,
      to: email,
    });

    if ("ok" in sendResult && sendResult.ok === false) {
      return withPublicApiCors(
        NextResponse.json(
          { error: "Could not send confirmation email" },
          { status: 502 },
        ),
      );
    }

    return withPublicApiCors(
      NextResponse.json({
        message: "Check your inbox to confirm your newsletter subscription.",
        success: true,
      }),
    );
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return withPublicApiCors(
      NextResponse.json({ error: "Failed to subscribe" }, { status: 500 }),
    );
  }
}
