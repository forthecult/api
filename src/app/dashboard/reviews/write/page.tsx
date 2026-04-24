import type { Metadata } from "next";

import { WriteReviewClient } from "./write-review-client";

export const metadata: Metadata = {
  description:
    "Leave a product review. Verified purchase reviews can appear in our public feed and Google’s product rating programs.",
  title: "Write a review",
};

type PageProps = {
  searchParams: Promise<{ product?: string }>;
};

export default async function WriteReviewPage({ searchParams }: PageProps) {
  const { product: productQ } = await searchParams;
  const initial = productQ?.trim() ?? "";
  return <WriteReviewClient initialProductSlug={initial} />;
}
