import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";

import { db } from "~/db";
import { emailEventTable } from "~/db/schema";
import { captureServerEvent } from "~/lib/analytics/posthog-server";
import { upsertSuppression } from "~/lib/email/suppression";

/**
 * POST /api/webhooks/resend
 * Verifies Svix signature, updates `email_event`, suppression, PostHog.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[webhooks/resend] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "missing svix headers" },
      { status: 400 },
    );
  }

  let evt: { data?: Record<string, unknown>; type?: string };
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-signature": svixSignature,
      "svix-timestamp": svixTimestamp,
    }) as typeof evt;
  } catch (err) {
    console.error("[webhooks/resend] verify failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const type = typeof evt.type === "string" ? evt.type : "";
  const data = evt.data ?? {};
  const emailId =
    (typeof data.email_id === "string" && data.email_id) ||
    (typeof data.id === "string" && data.id) ||
    "";
  const toList = data.to;
  const firstTo =
    Array.isArray(toList) && typeof toList[0] === "string"
      ? toList[0].toLowerCase()
      : typeof toList === "string"
        ? toList.toLowerCase()
        : "";

  const rowStatus = mapEventToRowStatus(type, data);
  if (emailId && rowStatus) {
    await db
      .update(emailEventTable)
      .set({
        status: rowStatus,
        updatedAt: new Date(),
      })
      .where(eq(emailEventTable.resendId, emailId));
  }

  if (type === "email.bounced" && firstTo) {
    const bounce = data.bounce as undefined | { type?: string };
    const isHard = bounce?.type === "hard";
    if (isHard) {
      await upsertSuppression({
        email: firstTo,
        notes: JSON.stringify(data).slice(0, 2000),
        reason: "bounced_hard",
        source: "resend_webhook",
      });
    }
    captureServerEvent(firstTo, "email_bounced", {
      email_id: emailId,
      hard: isHard,
    });
  }

  if (type === "email.complained" && firstTo) {
    await upsertSuppression({
      email: firstTo,
      notes: JSON.stringify(data).slice(0, 2000),
      reason: "complaint",
      source: "resend_webhook",
    });
    captureServerEvent(firstTo, "email_complained", { email_id: emailId });
  }

  if (type === "email.delivered" && emailId) {
    captureServerEvent(firstTo || emailId, "email_delivered", {
      email_id: emailId,
    });
  }
  if (type === "email.opened" && emailId) {
    captureServerEvent(firstTo || emailId, "email_opened", {
      email_id: emailId,
    });
  }
  if (type === "email.clicked" && emailId) {
    captureServerEvent(firstTo || emailId, "email_clicked", {
      email_id: emailId,
    });
  }

  return NextResponse.json({ received: true });
}

function mapEventToRowStatus(
  type: string,
  data: Record<string, unknown>,
):
  | "bounced_hard"
  | "bounced_soft"
  | "clicked"
  | "complained"
  | "delivered"
  | "failed"
  | "opened"
  | "sent"
  | null {
  switch (type) {
    case "email.bounced": {
      const bounce = data.bounce as undefined | { type?: string };
      return bounce?.type === "hard" ? "bounced_hard" : "bounced_soft";
    }
    case "email.clicked":
      return "clicked";
    case "email.complained":
      return "complained";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
    case "email.failed":
      return "failed";
    case "email.opened":
      return "opened";
    case "email.sent":
      return "sent";
    default:
      return null;
  }
}
