/**
 * Sends the eSIM activation email after fulfillment.
 */

import { createElement } from "react";

import { EsimActivationEmail } from "~/emails/esim-activation";
import { getPublicSiteUrl } from "~/lib/app-url";
import { fetchRecommendedProductsForEmail } from "~/lib/email/email-product-recs";
import { sendEmail } from "~/lib/email/send-email";

export interface EsimActivationItem {
  activationLink: null | string;
  packageName: string;
}

export interface SendEsimActivationEmailParams {
  /** When true, include a CTA to create an account (for guest purchasers). */
  isGuest: boolean;
  items: EsimActivationItem[];
  orderId: string;
  to: string;
}

export async function sendEsimActivationEmail(
  params: SendEsimActivationEmailParams,
): Promise<void> {
  const { isGuest, items, orderId, to } = params;
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

  const ctaUrl = isGuest ? signupUrl : dashboardEsimUrl;
  const ctaLabel = isGuest ? "Create account" : "View my eSIMs";
  const subject = "Your eSIM is ready to activate";

  const picks = await fetchRecommendedProductsForEmail({
    limit: 4,
    orderId,
  });

  try {
    await sendEmail({
      correlationId: `${orderId}-esim-activation`,
      kind: "esim_activation",
      react: createElement(EsimActivationEmail, {
        bodyText: body,
        ctaLabel,
        ctaUrl,
        productPicks: picks,
      }),
      subject,
      to,
    });
  } catch (err) {
    console.error("[sendEsimActivationEmail] send failed:", err);
  }

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY) {
    console.log("[sendEsimActivationEmail] No RESEND_API_KEY - would send:", {
      isGuest,
      items: items.length,
      subject,
      to,
    });
  }
}
