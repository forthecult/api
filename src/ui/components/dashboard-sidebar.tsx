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
import { useCallback, useEffect, useState } from "react";

import { signOut } from "~/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";

type Counts = {
  orders: number;
  wishlist: number;
  addresses: number;
  supportTickets: number;
  paymentMethods: number;
};

const defaultCounts: Counts = {
  orders: 0,
  wishlist: 0,
  addresses: 0,
  supportTickets: 0,
  paymentMethods: 0,
};

/** Dispatch from pages that change counts (e.g. new/deleted support ticket) so sidebar refetches. */
export const DASHBOARD_COUNTS_INVALIDATE = "dashboard:counts-invalidate";

function fetchCounts(): Promise<Counts> {
  return fetch("/api/dashboard/counts", { credentials: "include" })
    .then((res) => (res.ok ? res.json() : defaultCounts))
    .catch(() => defaultCounts);
}

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
      "flex items-center justify-between gap-2 rounded-r-md px-3 py-2.5 text-sm font-medium transition-colors",
      isActive(href)
        ? "border-l-4 border-primary bg-primary/5 text-primary"
        : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    );

  return (
    <aside
      className={cn(
        "w-56 shrink-0 rounded-lg border bg-card p-4",
        "flex flex-col gap-6",
      )}
    >
      <nav className="flex flex-1 flex-col gap-6" aria-label="Dashboard">
        <div>
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dashboard
          </h2>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/dashboard/orders"
                className={navLinkClass("/dashboard/orders")}
              >
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4 shrink-0" aria-hidden />
                  Orders
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {counts.orders}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/wishlist"
                className={navLinkClass("/dashboard/wishlist")}
              >
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4 shrink-0" aria-hidden />
                  Wishlist
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {counts.wishlist}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/support-tickets"
                className={navLinkClass("/dashboard/support-tickets")}
              >
                <span className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 shrink-0" aria-hidden />
                  Support Tickets
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {counts.supportTickets}
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/affiliate"
                className={navLinkClass("/dashboard/affiliate")}
              >
                <span className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                  Affiliate
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/esim"
                className={navLinkClass("/dashboard/esim")}
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
                  My eSIMs
                </span>
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Account Settings
          </h2>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/dashboard/profile"
                className={navLinkClass("/dashboard/profile")}
              >
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 shrink-0" aria-hidden />
                  Profile Info
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/settings"
                className={navLinkClass("/dashboard/settings")}
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 shrink-0" aria-hidden />
                  Notifications
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/security"
                className={navLinkClass("/dashboard/security")}
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0" aria-hidden />
                  Security
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/addresses"
                className={navLinkClass("/dashboard/addresses")}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  Addresses
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {counts.addresses}
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="border-t pt-4">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Logout
        </Button>
      </div>
    </aside>
  );
}
