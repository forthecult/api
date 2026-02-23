"use client";

import { Star } from "lucide-react";
import React, { useEffect, useState } from "react";

import { cn } from "~/lib/cn";

interface ProductReviewsCarouselProps {
  className?: string;
}

interface ReviewItem {
  comment: string;
  displayName: string;
  id: string;
  productName?: null | string;
  rating: number;
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
      <div
        className={`
        w-full max-w-7xl px-4
        sm:px-6
        lg:px-8
      `}
      >
        <h2
          className="mb-2 text-left text-2xl font-bold text-foreground"
          id="customer-reviews-heading"
        >
          What customers are saying
        </h2>
        <p className="mb-6 text-muted-foreground">
          Reviews from the community
          lifestyle
        </p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div
            className={`
            h-8 w-8 animate-spin rounded-full border-4 border-primary
            border-t-transparent
          `}
          />
        </div>
      ) : (
        <div
          className={`
          relative flex w-full flex-col items-center justify-center
          overflow-hidden
        `}
        >
          <div
            className={`
            marquee-edge-fade group flex flex-row overflow-hidden p-2
            [gap:var(--gap)]
            [--gap:1rem]
          `}
          >
            <div
              className={`
              animate-marquee-testimonials flex shrink-0 flex-row justify-around
              [gap:var(--gap)]
            `}
            >
              {/* Duplicate reviews 2x for seamless marquee loop */}
              {[...Array(2)].map((_, setIndex) =>
                reviews.map((review, i) => (
                  <ReviewCard
                    key={`review-${review.id}-${setIndex}-${i}`}
                    review={review}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Review card with product name header (unlike homepage testimonials).
 */
function ReviewCard({
  className,
  review,
}: {
  className?: string;
  review: ReviewItem;
}) {
  const stars = Math.min(5, Math.max(0, Math.round(review.rating ?? 0)));

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border-t",
        "bg-gradient-to-b from-muted/50 to-muted/10",
        `
          p-4 text-start
          sm:p-6
        `,
        "hover:from-muted/60 hover:to-muted/20",
        `
          max-w-[320px]
          sm:max-w-[320px]
        `,
        "transition-colors duration-300",
        className,
      )}
    >
      {/* Product name header */}
      {review.productName && (
        <p
          className={`
          mb-3 text-xs font-medium tracking-wide text-muted-foreground/70
          uppercase
        `}
        >
          {review.productName}
        </p>
      )}

      {/* Author and rating */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h3 className="text-md leading-none font-semibold">
            {review.displayName}
          </h3>
          {review.rating != null && review.rating > 0 && (
            <div
              aria-label={`${stars} out of 5 stars`}
              className="mt-1.5 flex items-center gap-0.5"
              role="img"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  aria-hidden
                  className={cn(
                    "h-4 w-4",
                    i <= stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40",
                  )}
                  key={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review text */}
      <p
        className={`
        sm:text-md
        mt-4 text-sm text-muted-foreground
      `}
      >
        {review.comment}
      </p>
    </div>
  );
}
