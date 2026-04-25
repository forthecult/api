import { describe, expect, it } from "bun:test";

import {
  deriveEmailIdempotencyKey,
  emailContentFingerprint,
} from "../src/lib/email/email-idempotency";

describe("email-idempotency", () => {
  it("fingerprint is stable for same inputs", () => {
    const a = emailContentFingerprint("<p>a</p>", "a");
    const b = emailContentFingerprint("<p>a</p>", "a");
    expect(a).toBe(b);
    expect(a).toHaveLength(48);
  });

  it("fingerprint changes when html or text changes", () => {
    const a = emailContentFingerprint("<p>a</p>", "a");
    const b = emailContentFingerprint("<p>b</p>", "a");
    const c = emailContentFingerprint("<p>a</p>", "b");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("idempotency key normalizes email casing", () => {
    const fp = emailContentFingerprint("h", "t");
    const lower = deriveEmailIdempotencyKey(
      "order_placed",
      "User@Example.com",
      "Subj",
      undefined,
      fp,
    );
    const upper = deriveEmailIdempotencyKey(
      "order_placed",
      "user@example.com",
      "Subj",
      undefined,
      fp,
    );
    expect(lower).toBe(upper);
    expect(lower).toHaveLength(64);
  });

  it("correlationId distinguishes otherwise identical sends", () => {
    const fp = emailContentFingerprint("h", "t");
    const a = deriveEmailIdempotencyKey(
      "order_placed",
      "a@b.co",
      "Subj",
      "cid-1",
      fp,
    );
    const b = deriveEmailIdempotencyKey(
      "order_placed",
      "a@b.co",
      "Subj",
      "cid-2",
      fp,
    );
    expect(a).not.toBe(b);
  });
});
