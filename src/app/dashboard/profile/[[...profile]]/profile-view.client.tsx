"use client";

import { ChevronRight, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useCurrentUserOrRedirect } from "~/lib/auth-client";
import { Card, CardContent } from "~/ui/primitives/card";

/** Only show real emails; hide wallet placeholders (e.g. solana_xxx@wallet.local) */
function showRealEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "—";
  const t = email.trim();
  if (!t || t.endsWith("@wallet.local") || /^(solana_|ethereum_)[^@]+@/i.test(t))
    return "—";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? email : "—";
}

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
          name: data.name ?? ([data.firstName, data.lastName].filter(Boolean).join(" ") || "User"),
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserIcon className="h-7 w-7 text-muted-foreground" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-6">
        {/* User summary card – wide, low height: avatar left, name+balance center, membership right */}
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-row items-center gap-4 py-3 pl-3 pr-4">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
              {profile?.image ? (
                <Image
                  src={profile.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {(profile?.firstName?.[0] ?? profile?.lastName?.[0] ?? displayName[0] ?? "?").toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground">
                CULT Balance: {formatBalance(cultBalanceCents)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Silver user
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Order status cards */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-4 sm:grid-cols-4">
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

      {/* Personal information – compact, low height */}
      <Card className="overflow-hidden">
        <Link
          href="/dashboard/profile/edit"
          className="block transition-colors hover:bg-muted/50"
          aria-label="Edit profile and personal details"
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-3 px-4 sm:grid-cols-3 md:grid-cols-6 md:gap-x-6 md:px-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  First Name
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {profile?.firstName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Last Name
                </span>
                <span className="text-sm font-medium text-foreground truncate">
                  {profile?.lastName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <span className="text-sm text-foreground truncate">
                  {showRealEmail(profile?.email)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Phone
                </span>
                <span className="text-sm text-foreground truncate">
                  {profile?.phone || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Birth date
                </span>
                <span className="text-sm text-foreground">—</span>
              </div>
              <div className="flex items-center justify-end text-muted-foreground col-span-2 sm:col-span-1 md:col-span-1 md:justify-end">
                <span className="text-sm">Edit</span>
                <ChevronRight className="ml-1 h-4 w-4 shrink-0" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}
