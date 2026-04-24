import { render } from "@react-email/render";
import { describe, expect, it } from "bun:test";
import { createElement } from "react";

import { NewsletterWelcomeDiscountEmail } from "../src/emails/newsletter-welcome-discount";

const MAX_BYTES = 102_000;

describe("React Email marketing templates", () => {
  it("newsletter welcome stays under Gmail clip limit and includes unsubscribe copy", async () => {
    const html = await render(
      createElement(NewsletterWelcomeDiscountEmail, {
        discountCode: "TEST10",
        unsubscribeUrl:
          "https://example.com/api/email/unsubscribe?token=testtoken",
      }),
      { pretty: false },
    );
    const bytes = Buffer.byteLength(html, "utf8");
    expect(bytes).toBeLessThan(MAX_BYTES);
    expect(html.toLowerCase()).toContain("unsubscribe");
  });
});
