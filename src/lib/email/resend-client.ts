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

export function getResendFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (from) return from;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_FROM_EMAIL must be set in production");
  }
  return "onboarding@resend.dev";
}
