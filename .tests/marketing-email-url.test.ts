import { describe, expect, it } from "bun:test";

import {
  appendEmailUtm,
  emailUtmQueryString,
} from "../src/lib/email/marketing-email-url";

describe("marketing-email-url", () => {
  it("appendEmailUtm adds params", () => {
    const u = appendEmailUtm(
      "https://store.example/shop",
      "welcome_funnel",
      "welcome_series_2",
    );
    expect(u).toContain("utm_source=email");
    expect(u).toContain("utm_medium=email");
    expect(u).toContain("utm_campaign=welcome_funnel");
    expect(u).toContain("utm_content=welcome_series_2");
  });

  it("skips tokenized URLs", () => {
    const raw =
      "https://store.example/confirm?token=abc&sig=1&utm_source=other";
    expect(appendEmailUtm(raw, "c", "x")).toBe(raw);
  });

  it("emailUtmQueryString encodes values", () => {
    const q = emailUtmQueryString("camp a", "content b");
    expect(q).toContain(encodeURIComponent("camp a"));
    expect(q).toContain(encodeURIComponent("content b"));
  });
});
