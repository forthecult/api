/**
 * Sends an OTP (one-time password) email for better-auth Email OTP plugin.
 * Used for sign-in, email verification, and forget-password flows.
 * Uses Resend when RESEND_API_KEY is set; in development logs the code to console.
 */
export async function sendVerificationOTPEmail(params: {
  otp: string;
  to: string;
  type: "change-email" | "email-verification" | "forget-password" | "sign-in";
}): Promise<void> {
  const { otp, to, type } = params;
  const appName = "For the Culture";

  const subject =
    type === "sign-in"
      ? `Your sign-in code for ${appName}`
      : type === "email-verification"
        ? `Verify your email for ${appName}`
        : type === "change-email"
          ? `Confirm your new email – ${appName}`
          : `Reset your password – ${appName}`;

  const purpose =
    type === "sign-in"
      ? "sign in to your account"
      : type === "email-verification"
        ? "verify your email address"
        : type === "change-email"
          ? "confirm your new email address"
          : "reset your password";

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
        html: `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #111;">Your verification code</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">Use this code to ${purpose}:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 24px 0;">${otp}</p>
  <p style="color: #666; font-size: 14px;">This code expires in a few minutes. If you didn't request this, you can ignore this email.</p>
  <p style="color: #666; font-size: 14px; margin-top: 32px;">— ${appName}</p>
</body></html>`,
        subject,
        text: `Your verification code: ${otp}\n\nUse this code to ${purpose}. This code expires in a few minutes.\n\n— ${appName}`,
        to,
      });
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[sendVerificationOTPEmail] OTP sent to:",
          to,
          "type:",
          type,
        );
      }
    } catch (err) {
      console.error("[sendVerificationOTPEmail] Resend send failed:", err);
      throw err;
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[sendVerificationOTPEmail] No RESEND_API_KEY - OTP for",
      to,
      "type:",
      type,
      "code:",
      otp,
    );
  }
}
