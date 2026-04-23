"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const SecurityPageClient = dynamic(
  () => import("./page.client").then((m) => m.SecurityPageClient),
  {
    loading: () => (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    ),
    ssr: false,
  },
);

export function SecurityLoader() {
  return <SecurityPageClient />;
}
