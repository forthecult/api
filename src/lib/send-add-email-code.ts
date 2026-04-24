/**
 * Sends the verification code when a user adds email & password to their account.
 */

import { createElement } from "react";

import { AddEmailCodeEmail } from "~/emails/add-email-code";
import { sendEmail } from "~/lib/email/send-email";

export async function sendAddEmailVerificationCode(params: {
  code: string;
  to: string;
}): Promise<void> {
  const { code, to } = params;
  const appName = "For the Culture";
  const subject = `Your verification code — ${appName}`;

  if (process.env.NODE_ENV === "development" && !process.env.RESEND_API_KEY?.trim()) {
    console.log(
      "[sendAddEmailVerificationCode] No RESEND_API_KEY - verification code for",
      to,
      ":",
      code,
    );
    return;
  }

  try {
    await sendEmail({
      correlationId: `${to}-add-email`,
      kind: "add_email_verification",
      react: createElement(AddEmailCodeEmail, { appName, code }),
      subject,
      to,
    });
    if (process.env.NODE_ENV === "development") {
      console.log("[sendAddEmailVerificationCode] Code sent to:", to);
    }
  } catch (err) {
    console.error("[sendAddEmailVerificationCode] send failed:", err);
    throw err;
  }
}
