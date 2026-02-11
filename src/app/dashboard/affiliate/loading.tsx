import { Skeleton } from "~/ui/primitives/skeleton";

export default function AffiliateLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`aff-skeleton-${i}`} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
