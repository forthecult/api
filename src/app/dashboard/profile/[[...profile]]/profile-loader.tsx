"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const ProfileViewClient = dynamic(
  () => import("./profile-view.client").then((m) => m.ProfileViewClient),
  {
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div
          className={`
          grid gap-6
          lg:grid-cols-3
        `}
        >
          <Skeleton className="h-48 rounded-lg" />
          <div
            className={`
            grid grid-cols-2 gap-4
            sm:grid-cols-4
          `}
          >
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    ),
    ssr: false,
  },
);

const EditProfilePageClient = dynamic(
  () => import("./page.client").then((m) => m.ProfilePageClient),
  {
    loading: () => (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex flex-col items-center gap-6">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div
            className={`
            grid w-full gap-4
            sm:grid-cols-2
          `}
          >
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton
              className={`
              h-16 w-full
              sm:col-span-2
            `}
            />
            <Skeleton
              className={`
              h-16 w-full
              sm:col-span-2
            `}
            />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    ),
    ssr: false,
  },
);

export function ProfileLoader({ segment }: { segment?: string[] }) {
  const isEdit = segment?.[0] === "edit";

  if (isEdit) {
    return <EditProfilePageClient />;
  }

  return <ProfileViewClient />;
}
