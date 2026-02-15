"use client";

import { Star } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

interface ReviewItem {
  id: string;
  comment: string;
  rating: number;
  displayName: string;
  productName?: string | null;
}

interface ProductReviewsCarouselProps {
  className?: string;
}

/**
 * Review card with product name header (unlike homepage testimonials).
 */
function ReviewCard({
  review,
  className,
}: {
  review: ReviewItem;
  className?: string;
}) {
  const stars = Math.min(5, Math.max(0, Math.round(review.rating ?? 0)));

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border-t",
        "bg-gradient-to-b from-muted/50 to-muted/10",
        "p-4 text-start sm:p-6",
        "hover:from-muted/60 hover:to-muted/20",
        "max-w-[320px] sm:max-w-[320px]",
        "transition-colors duration-300",
        className,
      )}
    >
      {/* Product name header */}
      {review.productName && (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
          {review.productName}
        </p>
      )}

      {/* Author and rating */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h3 className="text-md font-semibold leading-none">
            {review.displayName}
          </h3>
          {review.rating != null && review.rating > 0 && (
            <div
              className="mt-1.5 flex items-center gap-0.5"
              aria-label={`${stars} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i <= stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40",
                  )}
                  aria-hidden
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review text */}
      <p className="mt-4 text-sm text-muted-foreground sm:text-md">
        {review.comment}
      </p>
    </div>
  );
}

/**
 * Reviews carousel for product pages with product name headers.
 * Fetches reviews from API and displays in a marquee animation.
 */
export function ProductReviewsCarousel({
  className,
}: ProductReviewsCarouselProps) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "/api/reviews?limit=20&includeProductName=true",
        );
        if (!res.ok) throw new Error("Failed to fetch reviews");
        const data = (await res.json()) as { items: ReviewItem[] };
        if (!cancelled) {
          setReviews(data.items ?? []);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render if no reviews
  if (!loading && reviews.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="customer-reviews-heading"
      className={cn(
        "mt-12 flex w-full flex-col items-center bg-background pb-14",
        className,
      )}
    >
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="customer-reviews-heading"
          className="mb-2 text-left text-2xl font-bold text-foreground"
        >
          What customers are saying
        </h2>
        <p className="mb-6 text-muted-foreground">
          Don't just take our word for it—hear from people who live the Culture
          lifestyle
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <div className="group flex flex-row overflow-hidden p-2 [gap:var(--gap)] [--gap:1rem]">
            <div className="flex shrink-0 flex-row justify-around animate-marquee-testimonials [gap:var(--gap)]">
              {/* Duplicate reviews 4x for seamless loop */}
              {[...Array(4)].map((_, setIndex) =>
                reviews.map((review, i) => (
                  <ReviewCard
                    key={`review-${review.id}-${setIndex}-${i}`}
                    review={review}
                  />
                )),
              )}
            </div>
          </div>

          {/* Gradient fades on edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-background sm:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-background sm:block" />
        </div>
      )}
    </section>
  );
}
