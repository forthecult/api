/**
 * Sends the verification code email when a user adds email & password to their account.
 * Uses Resend when RESEND_API_KEY is set; in development logs the code to console.
 */
export async function sendAddEmailVerificationCode(params: {
  to: string;
  code: string;
}): Promise<void> {
  const { to, code } = params;
  const appName = "For the Culture";

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
        subject: `Your verification code ${appName}`,
        html: `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #111;">Verify your email</h1>
  <p style="color: #333; font-size: 16px; line-height: 1.6;">You requested to add this email to your ${appName} account. Use this code to verify you own this address:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 24px 0;">${code}</p>
  <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
  <p style="color: #666; font-size: 14px; margin-top: 32px;">— ${appName}</p>
</body></html>`,
        text: `Verify your email\n\nUse this code to verify you own this address: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can ignore this email.\n\n— ${appName}`,
      });
      if (process.env.NODE_ENV === "development") {
        console.log("[sendAddEmailVerificationCode] Code sent to:", to);
      }
    } catch (err) {
      console.error("[sendAddEmailVerificationCode] Resend send failed:", err);
      throw err;
    }
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.log(
      "[sendAddEmailVerificationCode] No RESEND_API_KEY - verification code for",
      to,
      ":",
      code,
    );
  }
}
