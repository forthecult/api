import { Card, CardContent, CardFooter } from "~/ui/primitives/card";

/**
 * Skeleton placeholder for ProductCard. Mirrors the exact same layout
 * (aspect-square image, title, rating, price, add-to-cart button)
 * so the page doesn't shift when real data loads.
 */
export function ProductCardSkeleton() {
  return (
    <div className="h-full">
      <Card className="relative flex h-full flex-col overflow-hidden rounded-lg py-0">
        {/* Image placeholder */}
        <div className="relative aspect-square animate-pulse rounded-t-lg bg-muted" />

        <CardContent className="flex flex-1 flex-col p-4 pt-4 min-h-0">
          {/* Title */}
          <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-5 w-1/2 animate-pulse rounded bg-muted" />
          {/* Rating */}
          <div className="mt-1.5 h-4 w-24 animate-pulse rounded bg-muted" />
          {/* Price */}
          <div className="mt-2 h-5 w-20 animate-pulse rounded bg-muted" />
          {/* Crypto price */}
          <div className="mt-1 h-4 w-28 animate-pulse rounded bg-muted" />
        </CardContent>

        <CardFooter className="mt-auto p-4 pt-0">
          {/* Add to cart button */}
          <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        </CardFooter>
      </Card>
    </div>
  );
}

/** Grid of skeleton cards for loading states. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
