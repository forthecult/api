import { Skeleton } from "~/ui/primitives/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-4 rounded-lg border p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              className="flex items-center justify-between"
              key={`settings-skeleton-${i}`}
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
