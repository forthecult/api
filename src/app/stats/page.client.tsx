"use client";

import {
  DollarSign,
  MessageSquare,
  Package,
  ShoppingCart,
  Star,
  Ticket,
} from "lucide-react";
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

type StoreStats = {
  orderCount: number;
  averageOrderValueCents: number;
  soldItems: number;
  mostPopularItem: { name: string; quantity: number } | null;
  supportTicketsCount: number;
  chatsCount: number;
};

export function StatsPageClient() {
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats", { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to load stats");
          return;
        }
        const data = (await res.json()) as StoreStats;
        if (!cancelled) setStats(data);
      } catch (e) {
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
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

  const cards = [
    {
      title: "Number of orders",
      description: "Paid or fulfilled orders",
      value: stats.orderCount.toLocaleString(),
      icon: Package,
    },
    {
      title: "Average order value",
      description: "Mean order total",
      value: formatCents(stats.averageOrderValueCents),
      icon: DollarSign,
    },
    {
      title: "Sold items",
      description: "Total units sold",
      value: stats.soldItems.toLocaleString(),
      icon: ShoppingCart,
    },
    {
      title: "Most popular item",
      description: stats.mostPopularItem
        ? `${stats.mostPopularItem.quantity} sold`
        : "No sales yet",
      value: stats.mostPopularItem?.name ?? "—",
      icon: Star,
    },
    {
      title: "Support tickets",
      description: "Total tickets opened",
      value: stats.supportTicketsCount.toLocaleString(),
      icon: Ticket,
    },
    {
      title: "Chats",
      description: "Support chat conversations",
      value: stats.chatsCount.toLocaleString(),
      icon: MessageSquare,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-1">{card.description}</CardDescription>
              <p className="text-2xl font-semibold tabular-nums">
                {card.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
