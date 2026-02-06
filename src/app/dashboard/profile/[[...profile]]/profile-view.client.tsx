"use client";

import { ChevronRight, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCurrentUserOrRedirect } from "~/lib/auth-client";
import { Card, CardContent } from "~/ui/primitives/card";

type OrderStats = {
  all: number;
  awaitingPayment: number;
  awaitingShipment: number;
  awaitingDelivery: number;
};

const defaultOrderStats: OrderStats = {
  all: 0,
  awaitingPayment: 0,
  awaitingShipment: 0,
  awaitingDelivery: 0,
};

function formatBalance(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function ProfileViewClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const [profile, setProfile] = useState<{
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string;
    image: string | null;
  } | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats>(defaultOrderStats);
  const [cultBalanceCents, setCultBalanceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [profileRes, countsRes] = await Promise.all([
        fetch("/api/user/profile", { credentials: "include" }),
        fetch("/api/dashboard/counts", { credentials: "include" }),
      ]);
      if (profileRes.ok) {
        const data = (await profileRes.json()) as {
          firstName?: string;
          lastName?: string;
          name?: string;
          email?: string;
          phone?: string;
          image?: string | null;
        };
        setProfile({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          name: data.name ?? [data.firstName, data.lastName].filter(Boolean).join(" ") || "User",
          email: data.email ?? user.email ?? "",
          phone: data.phone ?? "",
          image: data.image ?? null,
        });
      } else {
        setProfile({
          firstName: "",
          lastName: "",
          name: user.name ?? "User",
          email: user.email ?? "",
          phone: "",
          image: user.image ?? null,
        });
      }
      if (countsRes.ok) {
        const counts = (await countsRes.json()) as {
          orderStats?: OrderStats;
        };
        setOrderStats(counts.orderStats ?? defaultOrderStats);
      }
    } catch {
      setProfile({
        firstName: "",
        lastName: "",
        name: user.name ?? "User",
        email: user.email ?? "",
        phone: "",
        image: user.image ?? null,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (isPending || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const displayName =
    profile?.name ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
    "User";

  return (
    <div className="container max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-2">
        <UserIcon className="h-7 w-7 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User summary card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="relative size-20 overflow-hidden rounded-full border-2 border-border bg-muted">
              {profile?.image ? (
                <Image
                  src={profile.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground">
                  {(profile?.firstName?.[0] ?? profile?.lastName?.[0] ?? displayName[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">
                CULT Balance: {formatBalance(cultBalanceCents)}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Silver user
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Order status cards */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 sm:grid-cols-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {orderStats.all}
              </span>
              <span className="text-sm text-muted-foreground">All Orders</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {String(orderStats.awaitingPayment).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">
                Awaiting Payment
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {String(orderStats.awaitingShipment).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">
                Awaiting Shipment
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {String(orderStats.awaitingDelivery).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">
                Awaiting Delivery
              </span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Personal information – clickable row */}
      <Card className="overflow-hidden">
        <Link
          href="/dashboard/profile/edit"
          className="block transition-colors hover:bg-muted/50"
          aria-label="Edit profile and personal details"
        >
          <CardContent className="p-0">
            <div className="grid gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 md:gap-6 md:p-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  First Name
                </span>
                <span className="text-sm font-medium text-foreground">
                  {profile?.firstName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Last Name
                </span>
                <span className="text-sm font-medium text-foreground">
                  {profile?.lastName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <span className="text-sm text-foreground">
                  {profile?.email || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Phone
                </span>
                <span className="text-sm text-foreground">
                  {profile?.phone || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Birth date
                </span>
                <span className="text-sm text-foreground">—</span>
              </div>
              <div className="flex items-center justify-end text-muted-foreground sm:col-span-2 md:col-span-1 md:justify-end">
                <span className="text-sm">Edit</span>
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}
