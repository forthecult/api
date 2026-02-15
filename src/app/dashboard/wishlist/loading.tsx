import { Skeleton } from "~/ui/primitives/skeleton";

export default function WishlistLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <div
        className={`
        grid gap-4
        sm:grid-cols-2
        lg:grid-cols-3
      `}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="rounded-lg border p-4" key={`wishlist-skeleton-${i}`}>
            <Skeleton className="aspect-square w-full rounded" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
