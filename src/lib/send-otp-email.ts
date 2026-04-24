/**
 * Sends an OTP email for better-auth Email OTP plugin.
 */

import { createElement } from "react";

import { OtpEmail } from "~/emails/otp";
import { sendEmail } from "~/lib/email/send-email";

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

  if (
    process.env.NODE_ENV === "development" &&
    !process.env.RESEND_API_KEY?.trim()
  ) {
    console.log(
      "[sendVerificationOTPEmail] No RESEND_API_KEY - OTP for",
      to,
      "type:",
      type,
      "code:",
      otp,
    );
    return;
  }

  try {
    await sendEmail({
      correlationId: `${to}-${type}-otp`,
      kind: "otp",
      react: createElement(OtpEmail, { appName, otp, purposeLine: purpose }),
      subject,
      to,
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[sendVerificationOTPEmail] OTP sent to:", to, "type:", type);
    }
  } catch (err) {
    console.error("[sendVerificationOTPEmail] send failed:", err);
    throw err;
  }
}
