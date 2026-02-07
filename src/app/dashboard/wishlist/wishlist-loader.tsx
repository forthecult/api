"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const WishlistPageClient = dynamic(
  () => import("./page.client").then((m) => m.WishlistPageClient),
  {
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

export function WishlistLoader() {
  return <WishlistPageClient />;
}
