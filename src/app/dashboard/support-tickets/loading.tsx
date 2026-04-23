import { Skeleton } from "~/ui/primitives/skeleton";

export default function SupportTicketsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          className="space-y-2 rounded-lg border p-4"
          key={`ticket-skeleton-${i}`}
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
