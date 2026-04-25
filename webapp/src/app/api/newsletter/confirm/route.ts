import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { db } from "~/db";
import { newsletterSubscriberTable } from "~/db/schema";
import { getResendClient } from "~/lib/email/resend-client";
import { getSuppressionReason } from "~/lib/email/suppression";
import { sendNewsletterWelcomeDiscountEmail } from "~/lib/send-newsletter-welcome-discount-email";

/**
 * GET /api/newsletter/confirm?token=...
 * Double opt-in: marks subscriber confirmed, adds Resend contact, sends welcome + discount.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return new NextResponse(
      "<!DOCTYPE html><html><body><p>Missing confirmation token.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      email: newsletterSubscriberTable.email,
      status: newsletterSubscriberTable.status,
    })
    .from(newsletterSubscriberTable)
    .where(eq(newsletterSubscriberTable.confirmationTokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return new NextResponse(
      "<!DOCTYPE html><html><body><p>This confirmation link is invalid or has expired.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 404 },
    );
  }

  if (row.status === "confirmed") {
    return new NextResponse(
      "<!DOCTYPE html><html><body><p>You’re already subscribed. Thanks!</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 },
    );
  }

  const suppressed = await getSuppressionReason(row.email);
  if (suppressed === "bounced_hard" || suppressed === "complaint") {
    return new NextResponse(
      "<!DOCTYPE html><html><body><p>We can’t complete this subscription for this address. Contact support if you need help.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 },
    );
  }

  const now = new Date();
  await db
    .update(newsletterSubscriberTable)
    .set({
      confirmationTokenHash: null,
      consentedAt: now,
      status: "confirmed",
      updatedAt: now,
    })
    .where(eq(newsletterSubscriberTable.email, row.email));

  const discountCode = (
    process.env.NEWSLETTER_WELCOME_DISCOUNT_CODE ?? "WELCOME10"
  ).trim();

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = getResendClient();
      const segmentId = process.env.RESEND_NEWSLETTER_SEGMENT_ID?.trim();
      const legacyAudienceId =
        process.env.RESEND_NEWSLETTER_AUDIENCE_ID?.trim();

      const contactRes = await resend.contacts.create({
        email: row.email,
        ...(segmentId
          ? { segments: [{ id: segmentId }] }
          : legacyAudienceId
            ? { audienceId: legacyAudienceId }
            : {}),
      });

      if (contactRes.error?.message) {
        if (!isLikelyDuplicateContactError(contactRes.error.message)) {
          console.error(
            "[newsletter/confirm] contacts.create:",
            contactRes.error,
          );
        }
      }

      const contactId =
        contactRes.data && "id" in contactRes.data
          ? String((contactRes.data as { id: string }).id)
          : null;
      if (contactId) {
        await db
          .update(newsletterSubscriberTable)
          .set({
            resendContactId: contactId,
            updatedAt: new Date(),
          })
          .where(eq(newsletterSubscriberTable.email, row.email));
      }

      await sendNewsletterWelcomeDiscountEmail({
        discountCode,
        to: row.email,
      });
    } catch (err) {
      console.error("[newsletter/confirm] post-confirm flow:", err);
      return new NextResponse(
        "<!DOCTYPE html><html><body><p>Your subscription was confirmed, but we couldn’t send the welcome email. Please contact support.</p></body></html>",
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 500,
        },
      );
    }
  }

  return new NextResponse(
    "<!DOCTYPE html><html><body><p>Thanks — you’re subscribed. Check your inbox for your welcome code.</p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 },
  );
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isLikelyDuplicateContactError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already") || m.includes("duplicate") || m.includes("exists")
  );
}
