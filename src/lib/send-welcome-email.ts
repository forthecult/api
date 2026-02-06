import { getNotificationTemplate } from "~/lib/notification-templates";

/**
 * Sends the welcome email after a user signs up.
 * - With RESEND_API_KEY: sends via Resend.
 * - Otherwise in development: logs to console.
 * - In production without RESEND_API_KEY: no email is sent.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  user: { name?: string | null; email: string; id?: string };
}): Promise<void> {
  const { to, user } = params;
  const template = getNotificationTemplate("welcome_email");
  const userName = user.name || "there";

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        typeof process.env.RESEND_FROM_EMAIL === "string" &&
        process.env.RESEND_FROM_EMAIL.length > 0
          ? process.env.RESEND_FROM_EMAIL
          : "onboarding@resend.dev";

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fortheculture.com";

      await resend.emails.send({
        from,
        to,
        subject: template.emailSubject || "Welcome!",
        html: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #111;">Welcome, ${userName}!</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">
    ${template.emailBody}
  </p>
  <p style="margin-top: 24px;">
    <a href="${appUrl}/shop" style="display: inline-block; background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
      Start Shopping
    </a>
  </p>
  <p style="color: #666; font-size: 14px; margin-top: 32px;">
    Thanks for joining us!<br/>
    — For the Culture
  </p>
</body>
</html>`,
        text: `Welcome, ${userName}!\n\n${template.emailBody}\n\nStart shopping: ${appUrl}/shop\n\nThanks for joining us!\n— For the Culture`,
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[sendWelcomeEmail] Welcome email sent to:", to);
      }
    } catch (err) {
      console.error("[sendWelcomeEmail] Resend send failed:", err);
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[sendWelcomeEmail] No RESEND_API_KEY - would send welcome email to:",
      to,
    );
  }
}
