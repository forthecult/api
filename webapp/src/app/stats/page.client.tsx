"use client";

import {
  DollarSign,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatCents } from "~/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Skeleton } from "~/ui/primitives/skeleton";

interface StoreStats {
  averageOrderValueCents: number;
  chatsCount: number;
  mostPopularItem: null | {
    name: string;
    productId?: string;
    quantity: number;
    slug?: null | string;
  };
  orderCount: number;
  soldItems: number;
  supportTicketsCount: number;
}

export function StatsPageClient() {
  const [stats, setStats] = useState<null | StoreStats>(null);
  const [error, setError] = useState<null | string>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats", { credentials: "include" });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(data.error ?? "Failed to load stats");
          return;
        }
        const data = (await res.json()) as StoreStats;
        if (!cancelled) setStats(data);
      } catch (_e) {
        if (!cancelled) setError("Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div
        className={`
          grid gap-4
          sm:grid-cols-2
          lg:grid-cols-3
        `}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const cards: {
    description: string;
    icon: typeof Package;
    productHref?: string;
    title: string;
    value: string;
  }[] = [
    {
      description: "Paid or fulfilled orders",
      icon: Package,
      title: "Number of orders",
      value: stats.orderCount.toLocaleString(),
    },
    {
      description: "Mean order total",
      icon: DollarSign,
      title: "Average order value",
      value: formatCents(stats.averageOrderValueCents),
    },
    {
      description: "Total units sold",
      icon: ShoppingCart,
      title: "Sold items",
      value: stats.soldItems.toLocaleString(),
    },
    {
      description: stats.mostPopularItem
        ? `${stats.mostPopularItem.quantity} sold`
        : "No sales yet",
      icon: Star,
      productHref:
        stats.mostPopularItem?.productId || stats.mostPopularItem?.slug
          ? `/${stats.mostPopularItem?.slug ?? stats.mostPopularItem?.productId ?? ""}`
          : undefined,
      title: "Most popular item",
      value: stats.mostPopularItem?.name ?? "—",
    },
    {
      description: "Total tickets opened",
      icon: Ticket,
      title: "Support tickets",
      value: stats.supportTicketsCount.toLocaleString(),
    },
    {
      description: "Support chat conversations",
      icon: MessageSquare,
      title: "Chats",
      value: stats.chatsCount.toLocaleString(),
    },
  ];

  return (
    <div
      className={`
        grid grid-cols-1 gap-4
        md:grid-cols-2 md:gap-8
        lg:grid-cols-3
      `}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader
              className={`
                flex flex-col flex-row items-center justify-between gap-0 pb-2
              `}
            >
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-1">
                {card.description}
              </CardDescription>
              {card.productHref ? (
                <Link
                  className={`
                    text-2xl font-semibold text-primary tabular-nums
                    underline-offset-4
                    hover:underline
                  `}
                  href={card.productHref}
                >
                  {card.value}
                </Link>
              ) : (
                <p className="text-2xl font-semibold tabular-nums">
                  {card.value}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
