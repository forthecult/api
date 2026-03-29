"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const EthPayPageClient = dynamic(
  () => import("./EthPayPageClient").then((m) => m.EthPayPageClient),
  {
    loading: () => (
      <div className="container mx-auto min-h-screen px-4 py-8">
        <Skeleton className="mb-6 h-16 w-full max-w-7xl" />
        <div
          className={`
          mx-auto flex max-w-7xl flex-col gap-6
          sm:flex-row
        `}
        >
          <Skeleton className="h-96 min-w-0 flex-1 rounded-xl" />
          <Skeleton
            className={`
            h-64 w-full rounded-xl
            sm:w-80
          `}
          />
        </div>
      </div>
    ),
    ssr: false,
  },
);

export function EthPayPageLoader() {
  return <EthPayPageClient />;
}
