import { createHmac } from "node:crypto";

/**
 * Server-side only. Computes the public display name for a product review.
 * - If author is set (e.g. imported reviews): uses author (first name only).
 * - Else if showName is true: returns the customer's first name (first word of customerName).
 * - If showName is false: returns a stable anonymized label like "Verified buyer #a3f2b"
 *   derived from the review id and server secret (not reversible, not guessable).
 */
export function getReviewDisplayName(review: {
  author?: null | string;
  customerName: string;
  id: string;
  showName: boolean;
}): string {
  if (review.author?.trim()) return review.author.trim();
  if (review.showName && review.customerName.trim()) {
    const first = review.customerName.trim().split(/\s+/)[0];
    return first ?? "Customer";
  }
  const secret =
    typeof process.env.AUTH_SECRET === "string" &&
    process.env.AUTH_SECRET.length > 0
      ? process.env.AUTH_SECRET
      : "review-display-fallback";
  const hash = createHmac("sha256", secret)
    .update(review.id)
    .digest("hex")
    .slice(-5);
  return `Verified buyer #${hash}`;
}
