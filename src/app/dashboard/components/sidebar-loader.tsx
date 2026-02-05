"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const DashboardSidebar = dynamic(
  () =>
    import("~/ui/components/dashboard-sidebar").then((m) => m.DashboardSidebar),
  {
    loading: () => (
      <aside className="w-56 shrink-0 rounded-lg border bg-card p-4">
        <div className="space-y-4">
          <Skeleton className="h-4 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-4 w-24 mt-4" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </aside>
    ),
    ssr: false,
  },
);

export function SidebarLoader() {
  return <DashboardSidebar />;
}
