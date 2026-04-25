import { Skeleton } from "~/ui/primitives/skeleton";

export default function BlogPostLoading() {
  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-12
        sm:px-6 sm:py-16
        lg:px-8
      `}
    >
      <Skeleton className="mb-6 aspect-video w-full rounded-lg" />
      <Skeleton className="mb-4 h-10 w-3/4" />
      <Skeleton className="mb-6 h-4 w-1/3" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
