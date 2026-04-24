import { describe, expect, test } from "bun:test";

import {
  signUnsubscribePayload,
  verifyUnsubscribeToken,
} from "../src/lib/email/unsubscribe-token";

describe("unsubscribe-token", () => {
  test("roundtrip marketing", () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "unit-test-secret-16chars";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signUnsubscribePayload({
      category: "marketing",
      email: "shopper@example.com",
      exp,
      v: 1,
    });
    const v = verifyUnsubscribeToken(token);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.email).toBe("shopper@example.com");
      expect(v.payload.category).toBe("marketing");
    }
  });

  test("rejects tampered token", () => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "unit-test-secret-16chars";
    const token = signUnsubscribePayload({
      category: "newsletter",
      email: "a@b.com",
      exp: Math.floor(Date.now() / 1000) + 60,
      v: 1,
    });
    const broken = `${token.slice(0, -4)}xxxx`;
    const v = verifyUnsubscribeToken(broken);
    expect(v.ok).toBe(false);
  });
});
