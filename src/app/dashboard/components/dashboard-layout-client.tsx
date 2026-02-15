"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "~/lib/cn";
import { Sheet, SheetContent } from "~/ui/primitives/sheet";

import { DashboardNavContent } from "~/ui/components/dashboard-nav-content";
import { SidebarLoader } from "./sidebar-loader";

const PATH_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/orders": "My Orders",
  "/dashboard/wishlist": "Wishlist",
  "/dashboard/support-tickets": "Support Tickets",
  "/dashboard/affiliate": "Affiliate",
  "/dashboard/esim": "My eSIMs",
  "/dashboard/profile": "Profile Info",
  "/dashboard/settings": "Notifications",
  "/dashboard/security": "Security",
  "/dashboard/addresses": "Addresses",
  "/dashboard/payment-methods": "Payment Methods",
  "/dashboard/billing": "Billing",
  "/dashboard/uploads": "Uploads",
};

function getDashboardTitle(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  // Exact match first
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  // Support ticket detail
  if (pathname.startsWith("/dashboard/support-tickets/")) return "Support Ticket";
  // Order detail
  if (pathname.startsWith("/dashboard/orders/")) return "Order";
  return "Dashboard";
}

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const title = getDashboardTitle(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <div
        className={cn(
          "container mx-auto flex max-w-7xl gap-6 px-4 py-6",
          "sm:px-6",
          "lg:px-8",
        )}
      >
        {/* Sidebar: hidden on mobile */}
        <div className="hidden shrink-0 md:block">
          <SidebarLoader />
        </div>

        <main className="min-w-0 flex-1">
          {/* Mobile: header with title + burger to the right */}
          <div
            className={cn(
              "mb-4 flex items-center justify-between gap-3 md:hidden",
            )}
          >
            <h1 className="text-xl font-semibold tracking-tight truncate">
              {title}
            </h1>
            <button
              type="button"
              aria-label="Open dashboard menu"
              className={cn(
                "shrink-0 rounded-md p-2 text-muted-foreground",
                "hover:bg-muted hover:text-foreground",
              )}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div
            className={cn(
              "w-full max-w-6xl space-y-6 p-4",
              "sm:p-6",
              "md:p-8",
              "[&_[data-slot=card]]:shadow-none",
            )}
          >
            {children}
          </div>
        </main>
      </div>

      <Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
        <SheetContent
          className="flex w-[min(85vw,320px)] flex-col gap-0 overflow-hidden p-0"
          side="left"
        >
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Menu
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DashboardNavContent onLinkClick={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
