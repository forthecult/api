"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowRight,
  ChevronRight,
  Crown,
  Shield,
  Star,
  UserIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { listUserAccounts, useCurrentUserOrRedirect } from "~/lib/auth-client";
import { Badge } from "~/ui/primitives/badge";
import { Card, CardContent } from "~/ui/primitives/card";

interface OrderStats {
  all: number;
  awaitingDelivery: number;
  awaitingPayment: number;
  awaitingShipment: number;
}

/** Only show real emails; hide wallet placeholders (e.g. solana_xxx@wallet.local) */
function showRealEmail(email: null | string | undefined): string {
  if (!email || typeof email !== "string") return "—";
  const t = email.trim();
  if (
    !t ||
    t.endsWith("@wallet.local") ||
    /^(solana_|ethereum_)[^@]+@/i.test(t)
  )
    return "—";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? email : "—";
}

const defaultOrderStats: OrderStats = {
  all: 0,
  awaitingDelivery: 0,
  awaitingPayment: 0,
  awaitingShipment: 0,
};

// Tier visual config (icons / accent colors)
const TIER_VISUALS: Record<
  number,
  { accent: string; icon: typeof Crown; name: string }
> = {
  1: { accent: "text-chart-1", icon: Crown, name: "Tier 1" },
  2: { accent: "text-chart-4", icon: Star, name: "Tier 2" },
  3: { accent: "text-chart-2", icon: Shield, name: "Tier 3" },
};

interface MembershipInfo {
  accent: string;
  icon: typeof Crown;
  isLocked: boolean;
  tierId: number;
  tierName: string;
  unlocksAt: null | string;
}

export function ProfileViewClient() {
  const { isPending, user } = useCurrentUserOrRedirect();
  const { publicKey } = useWallet();
  const connectedWallet = publicKey?.toBase58() ?? null;
  
  // linked Solana wallet from user's account (for when wallet adapter isn't connected)
  const [linkedSolanaWallet, setLinkedSolanaWallet] = useState<string | null>(null);
  
  // effective wallet: prefer connected wallet, fall back to linked wallet
  const wallet = connectedWallet ?? linkedSolanaWallet;
  
  const [profile, setProfile] = useState<null | {
    email: string;
    firstName: string;
    image: null | string;
    lastName: string;
    name: string;
    phone: string;
  }>(null);
  const [orderStats, setOrderStats] = useState<OrderStats>(defaultOrderStats);
  const [walletCultBalance, setWalletCultBalance] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // fetch linked Solana wallet when user is logged in
  useEffect(() => {
    if (!user?.id) {
      setLinkedSolanaWallet(null);
      return;
    }
    let cancelled = false;
    listUserAccounts()
      .then((res) => {
        if (cancelled || res.error) return;
        const solana = (res.data ?? []).find(
          (a: { providerId?: string }) => a.providerId === "solana",
        ) as { accountId: string } | undefined;
        if (!cancelled) setLinkedSolanaWallet(solana?.accountId ?? null);
      })
      .catch(() => {
        if (!cancelled) setLinkedSolanaWallet(null);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Fetch membership tier from staking balance API (which includes tier) + wallet balance
  useEffect(() => {
    if (!wallet) {
      setMembership(null);
      setWalletCultBalance(null);
      return;
    }
    setMembershipLoading(true);
    Promise.all([
      fetch(
        `/api/governance/staked-balance?wallet=${encodeURIComponent(wallet)}`,
      ).then((r) => r.json()),
      fetch(
        `/api/governance/wallet-balance?wallet=${encodeURIComponent(wallet)}`,
      ).then((r) => r.json()),
    ])
      .then(
        ([stakingData, walletData]: [
          {
            lock?: null | { isLocked?: boolean; unlocksAt?: string };
            memberTier?: null | number;
            stakedBalance?: string;
          },
          {
            balance?: string;
          },
        ]) => {
          // set wallet balance
          const walletBal = Number.parseFloat(walletData.balance ?? "0");
          setWalletCultBalance(walletBal > 0 ? walletData.balance ?? null : null);

          // set membership from API-provided tier
          const tierId = stakingData.memberTier;
          if (tierId != null) {
            const visual = TIER_VISUALS[tierId] ?? TIER_VISUALS[3];
            if (visual) {
              setMembership({
                accent: visual.accent,
                icon: visual.icon,
                isLocked: stakingData.lock?.isLocked ?? false,
                tierId,
                tierName: visual.name,
                unlocksAt: stakingData.lock?.unlocksAt ?? null,
              });
            } else {
              setMembership(null);
            }
          } else {
            setMembership(null);
          }
        },
      )
      .catch(() => {
        setMembership(null);
        setWalletCultBalance(null);
      })
      .finally(() => setMembershipLoading(false));
  }, [wallet]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [profileRes, countsRes] = await Promise.all([
        fetch("/api/user/profile", { credentials: "include" }),
        fetch("/api/dashboard/counts", { credentials: "include" }),
      ]);
      if (profileRes.ok) {
        const data = (await profileRes.json()) as {
          email?: string;
          firstName?: string;
          image?: null | string;
          lastName?: string;
          name?: string;
          phone?: string;
        };
        setProfile({
          email: data.email ?? user.email ?? "",
          firstName: data.firstName ?? "",
          image: data.image ?? null,
          lastName: data.lastName ?? "",
          name:
            data.name ??
            ([data.firstName, data.lastName].filter(Boolean).join(" ") ||
              "User"),
          phone: data.phone ?? "",
        });
      } else {
        setProfile({
          email: user.email ?? "",
          firstName: "",
          image: user.image ?? null,
          lastName: "",
          name: user.name ?? "User",
          phone: "",
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
        email: user.email ?? "",
        firstName: "",
        image: user.image ?? null,
        lastName: "",
        name: user.name ?? "User",
        phone: "",
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
        <UserIcon aria-hidden className="h-7 w-7 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
      </div>

      <div
        className={`
        grid gap-6
        lg:grid-cols-6
      `}
      >
        {/* User summary card – takes half the row so it can expand to the right */}
        <Card className="lg:col-span-3">
          <CardContent
            className={`
            flex flex-row items-center gap-4 py-3 pr-4 pl-3
          `}
          >
            <div
              className={`
              relative size-14 shrink-0 overflow-hidden rounded-full border-2
              border-border bg-muted
            `}
            >
              {profile?.image ? (
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="56px"
                  src={profile.image}
                />
              ) : (
                <span
                  className={`
                  flex size-full items-center justify-center text-lg
                  font-semibold text-muted-foreground
                `}
                >
                  {(
                    profile?.firstName?.[0] ??
                    profile?.lastName?.[0] ??
                    displayName[0] ??
                    "?"
                  ).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-sm text-muted-foreground">
                CULT Balance: {walletCultBalance ? `${Number(walletCultBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} CULT` : "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {membershipLoading ? (
                <span className="text-xs text-muted-foreground">Loading…</span>
              ) : membership ? (
                <Badge className="gap-1.5" variant="outline">
                  <membership.icon
                    className={`
                      h-3.5 w-3.5
                      ${membership.accent}
                    `}
                  />
                  {membership.tierName} Member
                </Badge>
              ) : (
                <Link
                  className={`
                    inline-flex items-center gap-1 rounded-md border
                    border-primary/20 bg-primary/5 px-2.5 py-1 text-xs
                    font-medium text-primary transition-colors
                    hover:bg-primary/10
                  `}
                  href="/membership"
                >
                  Join the Cult
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Order status cards */}
        <div
          className={`
          grid grid-cols-2 gap-4
          sm:grid-cols-4
          lg:col-span-3
        `}
        >
          <Card>
            <CardContent
              className={`
              flex flex-col items-center justify-center p-4 text-center
            `}
            >
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {orderStats.all}
              </span>
              <span className="text-sm text-muted-foreground">All Orders</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent
              className={`
              flex flex-col items-center justify-center p-4 text-center
            `}
            >
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {String(orderStats.awaitingPayment).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">
                Awaiting Payment
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent
              className={`
              flex flex-col items-center justify-center p-4 text-center
            `}
            >
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {String(orderStats.awaitingShipment).padStart(2, "0")}
              </span>
              <span className="text-sm text-muted-foreground">
                Awaiting Shipment
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardContent
              className={`
              flex flex-col items-center justify-center p-4 text-center
            `}
            >
              <span className="text-2xl font-bold text-foreground tabular-nums">
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
          aria-label="Edit profile and personal details"
          className={`
            block transition-colors
            hover:bg-muted/50
          `}
          href="/dashboard/profile/edit"
        >
          <CardContent className="p-0">
            <div
              className={`
              grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3
              sm:grid-cols-3
              md:grid-cols-6 md:gap-x-6 md:px-5
            `}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  First Name
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                  {profile?.firstName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Last Name
                </span>
                <span className="truncate text-sm font-medium text-foreground">
                  {profile?.lastName || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Email
                </span>
                <span className="truncate text-sm text-foreground">
                  {showRealEmail(profile?.email)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Phone
                </span>
                <span className="truncate text-sm text-foreground">
                  {profile?.phone || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
                >
                  Birth date
                </span>
                <span className="text-sm text-foreground">—</span>
              </div>
              <div
                className={`
                col-span-2 flex items-center justify-end text-muted-foreground
                sm:col-span-1
                md:col-span-1 md:justify-end
              `}
              >
                <span className="text-sm">Edit</span>
                <ChevronRight aria-hidden className="ml-1 h-4 w-4 shrink-0" />
              </div>
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}

