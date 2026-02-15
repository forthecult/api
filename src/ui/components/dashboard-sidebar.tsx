"use client";

import { cn } from "~/lib/cn";

import { DashboardNavContent } from "./dashboard-nav-content";

/** Re-export for pages that invalidate counts (e.g. support ticket list). */
export { DASHBOARD_COUNTS_INVALIDATE } from "./dashboard-nav-content";

export function DashboardSidebar() {
  return (
    <aside
      className={cn(
        "w-56 shrink-0 rounded-lg border bg-card p-4",
        "flex flex-col gap-6",
      )}
    >
      <DashboardNavContent variant="sidebar" />
    </aside>
  );
}
