import { Skeleton } from "~/ui/primitives/skeleton";

export default function SupportTicketsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`ticket-skeleton-${i}`}
          className="rounded-lg border p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
