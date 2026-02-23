import { Skeleton } from "~/ui/primitives/skeleton";

export default function BlogPostLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Skeleton className="mb-6 aspect-video w-full rounded-lg" />
      <Skeleton className="mb-4 h-10 w-3/4" />
      <Skeleton className="mb-6 h-4 w-1/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}
