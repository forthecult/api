import { describe, expect, test } from "bun:test";

import {
  bypassesConsentGate,
  isMarketingEmailKind,
} from "../src/lib/email/email-send-kind";

describe("email-send-kind", () => {
  test("marketing kinds", () => {
    expect(isMarketingEmailKind("welcome_email")).toBe(true);
    expect(isMarketingEmailKind("newsletter_welcome_discount")).toBe(true);
    expect(isMarketingEmailKind("order_placed")).toBe(false);
  });

  test("consent bypass", () => {
    expect(bypassesConsentGate("otp")).toBe(true);
    expect(bypassesConsentGate("password_reset")).toBe(true);
    expect(bypassesConsentGate("newsletter_confirm")).toBe(true);
    expect(bypassesConsentGate("order_placed")).toBe(false);
  });
});
