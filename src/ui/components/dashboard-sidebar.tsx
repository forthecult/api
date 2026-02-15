"use client";

import {
  Headphones,
  Heart,
  Link2,
  LogOut,
  MapPin,
  Package,
  Settings,
  Shield,
  Smartphone,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { signOut } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";

interface Counts {
  addresses: number;
  orders: number;
  paymentMethods: number;
  supportTickets: number;
  wishlist: number;
}

const defaultCounts: Counts = {
  addresses: 0,
  orders: 0,
  paymentMethods: 0,
  supportTickets: 0,
  wishlist: 0,
};

/** Dispatch from pages that change counts (e.g. new/deleted support ticket) so sidebar refetches. */
export const DASHBOARD_COUNTS_INVALIDATE = "dashboard:counts-invalidate";

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>(defaultCounts);
  useEffect(() => {
    let cancelled = false;
    fetchCounts().then((data) => {
      if (!cancelled) setCounts(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void fetchCounts().then(setCounts);
    };
    window.addEventListener(DASHBOARD_COUNTS_INVALIDATE, handler);
    return () =>
      window.removeEventListener(DASHBOARD_COUNTS_INVALIDATE, handler);
  }, []);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router]);

  const isActive = useCallback(
    (href: string) =>
      pathname === href ||
      (href !== "/dashboard" && pathname?.startsWith(href)),
    [pathname],
  );

  const navLinkClass = (href: string) =>
    cn(
      `
        flex items-center justify-between gap-2 rounded-r-md px-3 py-2.5 text-sm
        font-medium transition-colors
      `,
      isActive(href)
        ? "border-l-4 border-primary bg-primary/5 text-primary"
        : `
          border-l-4 border-transparent text-muted-foreground
          hover:bg-muted/50 hover:text-foreground
        `,
    );

  return (
    <aside
      className={cn(
        "w-56 shrink-0 rounded-lg border bg-card p-4",
        "flex flex-col gap-6",
      )}
    >
      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-6">
        <div>
          <h2
            className={`
            mb-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground
            uppercase
          `}
          >
            Dashboard
          </h2>
          <ul className="space-y-0.5">
            <li>
              <Link
                className={navLinkClass("/dashboard/orders")}
                href="/dashboard/orders"
              >
                <span className="flex items-center gap-2">
                  <Package aria-hidden className="h-4 w-4 shrink-0" />
                  Orders
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {counts.orders}
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/wishlist")}
                href="/dashboard/wishlist"
              >
                <span className="flex items-center gap-2">
                  <Heart aria-hidden className="h-4 w-4 shrink-0" />
                  Wishlist
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {counts.wishlist}
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/support-tickets")}
                href="/dashboard/support-tickets"
              >
                <span className="flex items-center gap-2">
                  <Headphones aria-hidden className="h-4 w-4 shrink-0" />
                  Support Tickets
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {counts.supportTickets}
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/affiliate")}
                href="/dashboard/affiliate"
              >
                <span className="flex items-center gap-2">
                  <Link2 aria-hidden className="h-4 w-4 shrink-0" />
                  Affiliate
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/esim")}
                href="/dashboard/esim"
              >
                <span className="flex items-center gap-2">
                  <Smartphone aria-hidden className="h-4 w-4 shrink-0" />
                  My eSIMs
                </span>
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2
            className={`
            mb-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground
            uppercase
          `}
          >
            Account Settings
          </h2>
          <ul className="space-y-0.5">
            <li>
              <Link
                className={navLinkClass("/dashboard/profile")}
                href="/dashboard/profile"
              >
                <span className="flex items-center gap-2">
                  <UserIcon aria-hidden className="h-4 w-4 shrink-0" />
                  Profile Info
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/settings")}
                href="/dashboard/settings"
              >
                <span className="flex items-center gap-2">
                  <Settings aria-hidden className="h-4 w-4 shrink-0" />
                  Notifications
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/security")}
                href="/dashboard/security"
              >
                <span className="flex items-center gap-2">
                  <Shield aria-hidden className="h-4 w-4 shrink-0" />
                  Security
                </span>
              </Link>
            </li>
            <li>
              <Link
                className={navLinkClass("/dashboard/addresses")}
                href="/dashboard/addresses"
              >
                <span className="flex items-center gap-2">
                  <MapPin aria-hidden className="h-4 w-4 shrink-0" />
                  Addresses
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {counts.addresses}
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="border-t pt-4">
        <Button
          className="w-full justify-center gap-2"
          onClick={() => void handleLogout()}
          type="button"
          variant="outline"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}

function fetchCounts(): Promise<Counts> {
  return fetch("/api/dashboard/counts", { credentials: "include" })
    .then((res) => (res.ok ? res.json() : defaultCounts))
    .catch(() => defaultCounts);
}
