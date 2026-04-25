import { Resend } from "resend";

let client: null | Resend = null;

export function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Resend `from` header. Use `RESEND_FROM_DISPLAY_NAME` + `RESEND_FROM_EMAIL` so recipients see
 * e.g. "James at For the Cult <orders@yourdomain.com>" (RFC 5322 display name + angle-addr).
 */
export function getResendFromAddress(): string {
  const email = process.env.RESEND_FROM_EMAIL?.trim();
  const display =
    process.env.RESEND_FROM_DISPLAY_NAME?.trim() || "James at For the Cult";
  if (email) {
    if (/^[^\s<]+@[^\s>]+$/u.test(email)) {
      return `${display} <${email}>`;
    }
    if (/<[^>]+@[^>]+>/u.test(email)) {
      return email;
    }
    return `${display} <${email}>`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL must be set in production");
  }
  return `${display} <onboarding@resend.dev>`;
}
