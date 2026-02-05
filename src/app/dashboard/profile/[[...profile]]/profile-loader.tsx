"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const ProfilePageClient = dynamic(
  () => import("./page.client").then((m) => m.ProfilePageClient),
  {
    loading: () => (
      <div className="container max-w-2xl space-y-6 p-4 md:p-8">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full sm:col-span-2" />
            <Skeleton className="h-16 w-full sm:col-span-2" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    ),
    ssr: false,
  },
);

export function ProfileLoader() {
  return <ProfilePageClient />;
}
