import { createHash } from "node:crypto";

import type { EmailSendKind } from "~/lib/email/email-send-kind";

/** Resend `Idempotency-Key` header value (max 64 hex chars). */
export function deriveEmailIdempotencyKey(
  kind: EmailSendKind,
  to: string,
  subject: string,
  correlationId: string | undefined,
  contentFingerprint: string,
): string {
  const base = `${kind}|${to.trim().toLowerCase()}|${subject}|${correlationId ?? ""}|${contentFingerprint}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 64);
}

/** Stable hash of rendered HTML + plain text for idempotency when correlationId is absent. */
export function emailContentFingerprint(html: string, text: string): string {
  return createHash("sha256")
    .update(html)
    .update("\0")
    .update(text)
    .digest("hex")
    .slice(0, 48);
}
