/**
 * Sends the eSIM activation email after fulfillment.
 * Includes activation link(s) and, for guests, a signup CTA so they can
 * create an account and see their eSIMs in the dashboard.
 */

import { getPublicSiteUrl } from "~/lib/app-url";
import { buildEmailHtml, plainTextToHtml } from "~/lib/email-layout";

export interface EsimActivationItem {
  packageName: string;
  activationLink: string | null;
}

export interface SendEsimActivationEmailParams {
  to: string;
  orderId: string;
  items: EsimActivationItem[];
  /** When true, include a CTA to create an account (for guest purchasers). */
  isGuest: boolean;
}

export async function sendEsimActivationEmail(
  params: SendEsimActivationEmailParams,
): Promise<void> {
  const { to, orderId, items, isGuest } = params;
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const dashboardEsimUrl = `${baseUrl}/dashboard/esim`;
  const signupUrl = `${baseUrl}/login?callbackUrl=${encodeURIComponent("/dashboard/esim")}`;

  let body =
    "Your eSIM is ready. You can activate it on your device using the link(s) below.\n\n";
  for (const item of items) {
    body += `${item.packageName}\n`;
    if (item.activationLink) {
      body += `Activate: ${item.activationLink}\n\n`;
    } else {
      body += `You can also open your dashboard to view and activate your eSIM: ${dashboardEsimUrl}\n\n`;
    }
  }
  body += `Order ID: ${orderId.slice(0, 8)}\n`;

  if (isGuest) {
    body +=
      "\nCreate an account with this email to manage your eSIM and view it anytime in your dashboard.";
  }

  const contentHtml = plainTextToHtml(body);
  const ctaUrl = isGuest ? signupUrl : dashboardEsimUrl;
  const ctaLabel = isGuest ? "Create account" : "View my eSIMs";
  const html = buildEmailHtml(contentHtml, { ctaUrl, ctaLabel });

  const subject = "Your eSIM is ready to activate";

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        typeof process.env.RESEND_FROM_EMAIL === "string" &&
        process.env.RESEND_FROM_EMAIL.length > 0
          ? process.env.RESEND_FROM_EMAIL
          : "onboarding@resend.dev";
      await resend.emails.send({
        from,
        to,
        subject,
        text: body + `\n\n${ctaLabel}: ${ctaUrl}`,
        html,
      });
    } catch (err) {
      console.error("[sendEsimActivationEmail] Resend send failed:", err);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[sendEsimActivationEmail] No RESEND_API_KEY - would send:", {
      to,
      subject,
      items: items.length,
      isGuest,
    });
  }
}
