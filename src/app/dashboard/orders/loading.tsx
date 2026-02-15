import { Skeleton } from "~/ui/primitives/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          className="flex items-center gap-4 rounded-lg border p-4"
          key={`order-skeleton-${i}`}
        >
          <Skeleton className="h-16 w-16 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
