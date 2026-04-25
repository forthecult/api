import { describe, expect, it } from "bun:test";

import { normalizeReviewItem } from "~/app/products/[id]/product-reviews-carousel";

describe("normalizeReviewItem", () => {
  it("drops invalid review records", () => {
    expect(normalizeReviewItem(null)).toBeNull();
    expect(normalizeReviewItem({})).toBeNull();
    expect(normalizeReviewItem({ id: 123 })).toBeNull();
  });

  it("coerces malformed fields into safe renderable values", () => {
    const normalized = normalizeReviewItem({
      comment: { nested: true },
      displayName: { bad: "value" },
      id: "rev_1",
      productName: { still: "bad" },
      rating: 42,
    });

    expect(normalized).toEqual({
      comment: "",
      displayName: "Verified Buyer",
      id: "rev_1",
      productName: null,
      rating: 5,
    });
  });
});
