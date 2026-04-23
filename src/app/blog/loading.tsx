import { Skeleton } from "~/ui/primitives/skeleton";

export default function BlogLoading() {
  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-12
        sm:px-6 sm:py-16
        lg:px-8
      `}
    >
      <Skeleton className="mb-8 h-10 w-48" />
      <div
        className={`
          grid gap-8
          sm:grid-cols-2
        `}
      >
        {[1, 2, 3, 4].map((i) => (
          <div className="flex flex-col gap-3" key={i}>
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
