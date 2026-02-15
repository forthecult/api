"use client";

import {
  BarChart3,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useSession } from "~/lib/auth-client";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/card";

const API_BASE = getMainAppUrl();

interface DashboardStats {
  averageOrderValueCents: number;
  grossSaleCents: number;
  marketShare: number;
  orderCount: number;
  productShare: number;
  recentOrders: {
    createdAt: string;
    email: string;
    id: string;
    items: {
      id: string;
      name: string;
      priceCents: number;
      quantity: number;
    }[];
    status: string;
    totalCents: number;
  }[];
  soldItems: number;
  stockOutProducts: {
    amountCents?: number;
    name: string;
    stock?: number;
  }[];
  totalSalesCents: number;
  totalShippingCents: number;
  visits: number;
  weeklySalesCents: number;
}

type Range = "daily" | "monthly" | "yearly";

export default function DashboardPage() {
  const { data, isPending } = useSession();
  const user = data?.user;
  const [range, setRange] = useState<Range>("monthly");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/dashboard-stats?range=${range}`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DashboardStats;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const name = user?.name?.split(" ")[0] ?? "Admin";
  const rangeLabel =
    range === "daily" ? "Daily" : range === "monthly" ? "Monthly" : "Yearly";

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`
        rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
        dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
      `}
      >
        {error}
        <Button
          className="mt-2"
          onClick={() => void fetchStats()}
          type="button"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div
        className={`
        flex flex-col gap-4
        sm:flex-row sm:items-center sm:justify-between
      `}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {name}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your store for{" "}
            {rangeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex gap-2">
          {(["daily", "monthly", "yearly"] as const).map((r) => (
            <Button
              className={
                range === r
                  ? "bg-primary text-primary-foreground"
                  : `
                    border border-border bg-background text-foreground
                    hover:bg-muted hover:text-foreground
                  `
              }
              key={r}
              onClick={() => setRange(r)}
              type="button"
            >
              {r === "daily" ? "Daily" : r === "monthly" ? "Monthly" : "Yearly"}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div
          className={`
          grid gap-4
          md:grid-cols-2
          lg:grid-cols-4
        `}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Card className="animate-pulse" key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <>
          <div
            className={`
            grid gap-4
            md:grid-cols-2
          `}
          >
            <Card>
              <CardHeader
                className={`
                flex flex-row items-center justify-between pb-2
              `}
              >
                <CardTitle className="text-sm font-medium">
                  {rangeLabel} visits
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.visits.toLocaleString()}
                </div>
                <CardDescription>No visit tracking yet</CardDescription>
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                className={`
                flex flex-row items-center justify-between pb-2
              `}
              >
                <CardTitle className="text-sm font-medium">
                  {rangeLabel} total sales
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(stats.totalSalesCents)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div
            className={`
            grid gap-4
            md:grid-cols-2
            lg:grid-cols-5
          `}
          >
            <Card>
              <CardHeader
                className={`
                flex flex-row items-center justify-between pb-2
              `}
              >
                <CardTitle className="text-sm font-medium">Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.orderCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                className={`
                flex flex-row items-center justify-between pb-2
              `}
              >
                <CardTitle className="text-sm font-medium">
                  Average order value
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.orderCount > 0
                    ? formatCents(stats.averageOrderValueCents ?? 0)
                    : "—"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader
                className={`
                flex flex-row items-center justify-between pb-2
              `}
              >
                <CardTitle className="text-sm font-medium">
                  Sold items
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.soldItems.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Gross sale
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(stats.grossSaleCents)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total shipping cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCents(stats.totalShippingCents)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent purchases</CardTitle>
              <CardDescription>All orders for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orders in this period.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left font-medium">Order ID</th>
                        <th className="p-2 text-left font-medium">Product</th>
                        <th className="p-2 text-left font-medium">Payment</th>
                        <th className="p-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.map((order) => (
                        <tr
                          className={`
                            border-b
                            hover:bg-muted/50
                          `}
                          key={order.id}
                        >
                          <td className="p-2 font-mono text-xs">
                            <Link
                              className={`
                                text-primary
                                hover:underline
                              `}
                              href={`/orders/${order.id}`}
                            >
                              #{order.id.slice(-8)}
                            </Link>
                          </td>
                          <td className="p-2">
                            {order.items.map((i) => i.name).join(", ") || "—"}
                          </td>
                          <td className="p-2 capitalize">{order.status}</td>
                          <td className="p-2 text-right">
                            {formatCents(order.totalCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock out products</CardTitle>
              <CardDescription>
                Stock is not tracked in the current schema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No stock-out data available.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}
