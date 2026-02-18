"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Globe,
  Minus,
  Shield,
  Signal,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useStakeTransaction } from "~/hooks/use-stake-transaction";
import { cn } from "~/lib/cn";
import { LOCK_12_MONTHS, LOCK_30_DAYS } from "~/lib/cult-staking";
import { formatEsimPackageName } from "~/lib/esim-format";
import { formatMarketCap, formatTokens, formatUsd } from "~/lib/format";
import { MEMBERSHIP_HOW_IT_WORKS } from "~/lib/membership-copy";
import {
  MEMBERSHIP_BENEFIT_ROWS,
  MEMBERSHIP_FAQ,
  MEMBERSHIP_TIERS,
} from "~/lib/membership-tiers";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

// ---------------------------------------------------------------------------
// Live pricing types
// ---------------------------------------------------------------------------

/** Shape of the /api/governance/token-price response */
interface TokenPriceResponse {
  data?: {
    fetchedAt: number;
    market: {
      liquidityUsd: number;
      marketCapUsd: number;
      volume24hUsd: number;
    };
    pricing: {
      bracket: string;
      tiers: {
        costUsd: number;
        tierId: number;
        tokensNeeded: number;
        tokensRaw: string;
      }[];
    };
    staking: { programConfigured: boolean; stakerCount: number };
    token: { decimals: number; mint: string; priceUsd: number; symbol: string };
  };
  status: boolean;
}

/** When true, staking/signup is disabled and the message "Membership signup will be available shortly" is shown. Set via NEXT_PUBLIC_STAKING_SIGNUP_DISABLED. */
const STAKING_SIGNUP_DISABLED =
  process.env.NEXT_PUBLIC_STAKING_SIGNUP_DISABLED === "true";

/** Temporary: when true, Connect Wallet & Stake is disabled and shows "Staking will be available in the next hour". Set to false when staking is live. */
const STAKING_AVAILABLE_NEXT_HOUR = true;

/** When true, hide the CULT price and market cap bar (token not launched yet). Set to false after launch. */
const HIDE_TOKEN_PRICE_AND_MC = true;

export function MembershipClient() {
  const [selectedTier, setSelectedTier] = useState<number>(1);
  const [stakeDuration, setStakeDuration] = useState<"12m" | "30d">("30d");

  // eSIM claim state
  const [claimEligible, setClaimEligible] = useState(false);
  const [claimAlreadyClaimed, setClaimAlreadyClaimed] = useState(false);
  const [claimTier, setClaimTier] = useState<null | number>(null);
  const [claimPending, setClaimPending] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [stakerClaimPackages, setStakerClaimPackages] = useState<
    {
      data_quantity: number;
      data_unit: string;
      has5g?: boolean;
      id: string;
      name: string;
      package_type?: string;
      package_validity: number;
      package_validity_unit: string;
    }[]
  >([]);
  const [stakerClaimPackagesLoading, setStakerClaimPackagesLoading] =
    useState(false);
  const [stakerClaimPackageType, setStakerClaimPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >("DATA-ONLY");
  const [stakerClaimCountryId, setStakerClaimCountryId] = useState<string>("");
  const [esimCountries, setEsimCountries] = useState<{ id: number; name: string }[]>([]);
  const [esimCountriesLoading, setEsimCountriesLoading] = useState(false);

  // Current stake (for "Your stake" + unstake)
  const [stakedBalanceDisplay, setStakedBalanceDisplay] = useState<string>("0");
  const [stakedBalanceRaw, setStakedBalanceRaw] = useState<string>("0");
  const [stakedLock, setStakedLock] = useState<{
    durationLabel: string;
    isLocked: boolean;
    secondsRemaining?: number;
    unlocksAt: string | null;
    stakedAt: string;
  } | null>(null);
  const [stakedBalanceLoading, setStakedBalanceLoading] = useState(false);
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [stakeMoreAmount, setStakeMoreAmount] = useState("");
  const [restakeAmount, setRestakeAmount] = useState("");
  const [restakeDuration, setRestakeDuration] = useState<"30d" | "12m">("30d");

  // Live pricing state
  const [pricingData, setPricingData] = useState<
    null | TokenPriceResponse["data"]
  >(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  const { openConnectModal, restake, restakePending, stake, stakePending, unstake, unstakePending, wallet } =
    useStakeTransaction();

  const refreshStakedBalance = useCallback(() => {
    if (!wallet) return;
    setStakedBalanceLoading(true);
    fetch(`/api/governance/staked-balance?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => r.json())
      .then(
        (data: {
          lock: null | {
            durationLabel: string;
            isLocked: boolean;
            secondsRemaining?: number;
            unlocksAt: string | null;
            stakedAt: string;
          };
          stakedBalance?: string;
          stakedBalanceRaw?: string;
        }) => {
          setStakedBalanceDisplay(data.stakedBalance ?? "0");
          setStakedBalanceRaw(data.stakedBalanceRaw ?? "0");
          setStakedLock(data.lock ?? null);
        },
      )
      .catch(() => {
        setStakedBalanceDisplay("0");
        setStakedBalanceRaw("0");
        setStakedLock(null);
      })
      .finally(() => setStakedBalanceLoading(false));
  }, [wallet]);

  // Fetch live pricing from the API (polls every 30s)
  useEffect(() => {
    let cancelled = false;
    async function fetchPricing() {
      try {
        const res = await fetch("/api/governance/token-price");
        const json = (await res.json()) as TokenPriceResponse;
        if (!cancelled && json.status && json.data) {
          setPricingData(json.data);
        }
      } catch {
        // silently retry on next interval
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    }
    fetchPricing();
    const interval = setInterval(fetchPricing, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch staked balance when wallet connects (and after stake/unstake via callbacks)
  useEffect(() => {
    if (!wallet) {
      setStakedBalanceDisplay("0");
      setStakedBalanceRaw("0");
      setStakedLock(null);
      return;
    }
    refreshStakedBalance();
  }, [wallet, refreshStakedBalance]);

  // Fetch claim status when wallet is connected
  useEffect(() => {
    if (!wallet) {
      setClaimEligible(false);
      setClaimAlreadyClaimed(false);
      setClaimTier(null);
      return;
    }
    fetch(
      `/api/esim/membership-claim/status?wallet=${encodeURIComponent(wallet)}`,
    )
      .then((r) => r.json())
      .then(
        (data: {
          claimed?: boolean;
          eligible?: boolean;
          tier?: null | number;
        }) => {
          setClaimEligible(data.eligible ?? false);
          setClaimAlreadyClaimed(data.claimed ?? false);
          setClaimTier(data.tier ?? null);
        },
      )
      .catch(() => {
        setClaimEligible(false);
        setClaimAlreadyClaimed(false);
      });
  }, [wallet]);

  // Derive pricing for the selected tier (membership uses CULT)
  const tokenSymbol = pricingData?.token.symbol ?? "CULT";
  const tokenPrice = pricingData?.token.priceUsd ?? 0;
  const marketCap = pricingData?.market.marketCapUsd ?? 0;

  const tierPriceMap = useMemo(() => {
    const map: Record<number, { costUsd: number; tokensNeeded: number }> = {};
    if (pricingData?.pricing.tiers) {
      for (const t of pricingData.pricing.tiers) {
        map[t.tierId] = { costUsd: t.costUsd, tokensNeeded: t.tokensNeeded };
      }
    }
    return map;
  }, [pricingData]);

  const selectedTierPrice = tierPriceMap[selectedTier];
  const stakeAmount = selectedTierPrice?.tokensNeeded ?? 0;

  /** Current tier from staked balance (1 = best, 3 = entry). Null if no stake or below tier 3. */
  const currentTierFromStake = useMemo(() => {
    const staked = Number(stakedBalanceDisplay);
    if (!Number.isFinite(staked) || staked <= 0) return null;
    const tiers = pricingData?.pricing?.tiers ?? [];
    const sorted = [...tiers].sort((a, b) => b.tokensNeeded - a.tokensNeeded);
    for (const t of sorted) {
      if (staked >= t.tokensNeeded) return t.tierId;
    }
    return null;
  }, [stakedBalanceDisplay, pricingData?.pricing?.tiers]);

  const selectedTierData = useMemo(
    () => MEMBERSHIP_TIERS.find((t) => t.id === selectedTier)!,
    [selectedTier],
  );

  const lockDuration = stakeDuration === "12m" ? LOCK_12_MONTHS : LOCK_30_DAYS;

  const scrollToTiers = useCallback(() => {
    document.getElementById("tiers")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollToCTA = useCallback(() => {
    document
      .getElementById("stake-cta")
      ?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleStake = useCallback(async () => {
    const ok = await stake(stakeAmount.toString(), lockDuration);
    if (ok) refreshStakedBalance();
  }, [stake, stakeAmount, lockDuration, refreshStakedBalance]);

  const handleUnstake = useCallback(async () => {
    const ok = await unstake(unstakeAmount);
    if (ok) {
      setUnstakeAmount("");
      refreshStakedBalance();
    }
  }, [unstake, unstakeAmount, refreshStakedBalance]);

  /** Amount needed to reach next tier (for "Stake X to reach Tier Y" button). Tier 2 → 1, Tier 3 → 2. */
  const upgradeTarget = useMemo(() => {
    if (currentTierFromStake !== 2 && currentTierFromStake !== 3) return null;
    const staked = Number(stakedBalanceDisplay);
    if (!Number.isFinite(staked) || staked <= 0) return null;
    const nextTier = currentTierFromStake === 2 ? 1 : 2;
    const nextTokens = tierPriceMap[nextTier]?.tokensNeeded;
    if (nextTokens == null) return null;
    const needed = Math.max(0, Math.ceil(nextTokens - staked));
    const tierName = MEMBERSHIP_TIERS.find((t) => t.id === nextTier)?.name ?? `Tier ${nextTier}`;
    return { nextTier, amount: needed, tierName };
  }, [currentTierFromStake, stakedBalanceDisplay, tierPriceMap]);

  const handleStakeMore = useCallback(async () => {
    const ok = await stake(stakeMoreAmount.trim(), lockDuration);
    if (ok) {
      setStakeMoreAmount("");
      refreshStakedBalance();
    }
  }, [stake, stakeMoreAmount, lockDuration, refreshStakedBalance]);

  const restakeLockDuration =
    restakeDuration === "12m" ? LOCK_12_MONTHS : LOCK_30_DAYS;
  const handleRestake = useCallback(async () => {
    const ok = await restake(restakeAmount, restakeLockDuration);
    if (ok) {
      setRestakeAmount("");
      refreshStakedBalance();
    }
  }, [restake, restakeAmount, restakeLockDuration, refreshStakedBalance]);

  const formatTimeUntilUnlock = useCallback(
    (sec: number): string => {
      if (sec <= 0) return "Unlocked";
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      if (days > 0) return `${days} day${days === 1 ? "" : "s"} until unlock`;
      if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} until unlock`;
      const mins = Math.max(1, Math.floor(sec / 60));
      return `${mins} minute${mins === 1 ? "" : "s"} until unlock`;
    },
    [],
  );

  // Fetch countries when eligible to claim (for country picker)
  useEffect(() => {
    if (!claimEligible && !claimAlreadyClaimed) return;
    setEsimCountriesLoading(true);
    fetch("/api/esim/countries")
      .then((r) => r.json())
      .then((data: { data?: { id: number; name: string }[]; status: boolean }) => {
        if (data.status && Array.isArray(data.data)) {
          setEsimCountries(
            data.data.slice().sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      })
      .catch(() => setEsimCountries([]))
      .finally(() => setEsimCountriesLoading(false));
  }, [claimEligible, claimAlreadyClaimed]);

  // Fetch 30-day eSIM packages (under $25) when eligible to claim
  useEffect(() => {
    if (!wallet || !claimEligible || claimAlreadyClaimed) {
      setStakerClaimPackages([]);
      return;
    }
    setStakerClaimPackagesLoading(true);
    const params = new URLSearchParams();
    params.set("package_type", stakerClaimPackageType);
    if (stakerClaimCountryId) params.set("country", stakerClaimCountryId);
    fetch(`/api/esim/packages/staker-claim?${params.toString()}`)
      .then((r) => r.json())
      .then(
        (data: {
          data?: {
            data_quantity: number;
            data_unit: string;
            has5g?: boolean;
            id: string;
            name: string;
            package_type?: string;
            package_validity: number;
            package_validity_unit: string;
          }[];
          status: boolean;
        }) => {
          if (data.status && Array.isArray(data.data)) {
            setStakerClaimPackages(data.data);
          }
        },
      )
      .catch(() => setStakerClaimPackages([]))
      .finally(() => setStakerClaimPackagesLoading(false));
  }, [
    wallet,
    claimEligible,
    claimAlreadyClaimed,
    stakerClaimPackageType,
    stakerClaimCountryId,
  ]);

  // ------ eSIM Claim handler (one package per staking period) ------
  const handleClaimEsim = useCallback(
    async (packageId: string) => {
      if (!wallet) {
        toast.error("Connect your wallet first");
        return;
      }
      setClaimPending(true);
      try {
        const res = await fetch("/api/esim/membership-claim", {
          body: JSON.stringify({ packageId, wallet }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const data = (await res.json()) as {
          data?: { message?: string };
          message?: string;
          status: boolean;
        };
        if (!res.ok || !data.status) {
          toast.error(data.message ?? "Failed to claim eSIM");
          return;
        }
        setClaimSuccess(true);
        setClaimAlreadyClaimed(true);
        toast.success(
          data.data?.message ??
            "Free eSIM claimed! You can activate it in your dashboard.",
        );
      } catch {
        toast.error("Network error — please try again");
      } finally {
        setClaimPending(false);
      }
    },
    [wallet],
  );

  return (
    <div
      className={`
      flex min-h-screen flex-col bg-gradient-to-b from-muted/50 via-background
      to-background
    `}
    >
      {/* ----------------------------------------------------------------- */}
      {/* Hero */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -top-32 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, var(--primary) 0%, transparent 70%)",
          }}
        />

        <div
          className={`
          relative z-10 container mx-auto max-w-5xl px-4 py-20 text-center
          sm:px-6 sm:py-28
          lg:px-8 lg:py-36
        `}
        >
          <Badge className="mb-6 gap-1.5 px-3 py-1" variant="secondary">
            <Sparkles className="h-3.5 w-3.5" />
            Membership
          </Badge>

          <h1
            className={`
            font-display text-4xl leading-tight font-bold tracking-tight
            text-foreground
            sm:text-5xl
            md:text-6xl
            lg:text-7xl
          `}
          >
            Join the{" "}
            <span
              className={`
              bg-gradient-to-r from-primary to-primary/70 bg-clip-text
              text-transparent
            `}
            >
              Cult
            </span>
          </h1>

          <p
            className={`
            mx-auto mt-6 max-w-2xl text-lg text-muted-foreground
            sm:text-xl
          `}
          >
            Stake {tokenSymbol} to unlock exclusive membership benefits. Free
            eSIM cards, free shipping, member-only discounts, and more. The
            longer you stake, the more you save.
          </p>

          {/* Live market data bar — hidden until token launch (price/MC unknown) */}
          {!HIDE_TOKEN_PRICE_AND_MC && pricingData && (
            <div
              className={`
              mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-6
              gap-y-2 text-sm text-muted-foreground
            `}
            >
              <span>
                <span className="font-medium text-foreground">
                  {tokenSymbol}
                </span>{" "}
                {formatUsd(tokenPrice)}
              </span>
              <span
                className={`
                hidden text-border
                sm:inline
              `}
              >
                |
              </span>
              <span>MC {formatMarketCap(marketCap)}</span>
            </div>
          )}

          <div
            className={`
            mt-10 flex flex-wrap items-center justify-center gap-4
          `}
          >
            <Button className="gap-2" onClick={scrollToTiers} size="lg">
              View Tiers
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div
        className={`
        container mx-auto max-w-7xl px-4
        sm:px-6
        lg:px-8
      `}
      >
        {/* --------------------------------------------------------------- */}
        {/* Stake & Join — below the fold, left card + right benefits */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          scroll-mt-20 py-16
          md:py-20
        `}
          id="stake-cta"
        >
          <div
            className={`
            flex flex-col gap-8
            md:flex-row md:gap-10
          `}
          >
            {/* Left: Stake card */}
            <div
              className={`
              w-full overflow-hidden rounded-2xl border border-border bg-card
              shadow-xl
              md:w-1/2 md:shrink-0
            `}
            >
              <div className="border-b bg-muted/30 px-6 py-5">
                <h2
                  className={`
                  font-display text-xl font-semibold text-foreground
                  md:text-2xl
                `}
                >
                  {wallet && Number(stakedBalanceRaw) > 0
                    ? "Upgrade Membership"
                    : `Stake ${tokenSymbol} & Join`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {wallet && Number(stakedBalanceRaw) > 0
                    ? "Stake more CULT to upgrade your tier."
                    : "Select your tier and duration, then connect your wallet to stake."}
                </p>
              </div>

              <div className="space-y-5 p-6">
                {STAKING_SIGNUP_DISABLED && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium text-foreground">
                    Membership signup will be available shortly.
                  </div>
                )}
                {/* Your stake — show when wallet connected */}
                {wallet && (
                  <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">
                      Your stake
                    </p>
                    {stakedBalanceLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading…
                      </p>
                    ) : Number(stakedBalanceRaw) === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        You have no staked balance. Stake below to join.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1 text-sm">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatTokens(Number(stakedBalanceDisplay))}{" "}
                              {tokenSymbol}
                            </span>
                            {currentTierFromStake != null && (
                              <span className="text-muted-foreground">
                                · {MEMBERSHIP_TIERS.find((t) => t.id === currentTierFromStake)?.name ?? `Tier ${currentTierFromStake}`}
                              </span>
                            )}
                          </div>
                          {stakedLock && (
                            <p className="text-muted-foreground">
                              {stakedLock.durationLabel}
                              {stakedLock.secondsRemaining != null && stakedLock.secondsRemaining > 0 ? (
                                <> · {formatTimeUntilUnlock(stakedLock.secondsRemaining)}</>
                              ) : stakedLock.unlocksAt ? (
                                <> · Unlocks {new Date(stakedLock.unlocksAt).toLocaleDateString(undefined, { dateStyle: "short" })}</>
                              ) : null}
                            </p>
                          )}
                        </div>
                        {(currentTierFromStake === 2 || currentTierFromStake === 3) && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-medium text-foreground">
                              Stake CULT to upgrade. Enter an amount or use the button to fill the amount needed for the next tier.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Input
                                className="font-mono max-w-[140px]"
                                disabled={STAKING_SIGNUP_DISABLED}
                                min={0}
                                onChange={(e) => setStakeMoreAmount(e.target.value)}
                                placeholder="Amount"
                                step="any"
                                type="number"
                                value={stakeMoreAmount}
                              />
                              {upgradeTarget && upgradeTarget.amount > 0 && !STAKING_SIGNUP_DISABLED && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setStakeMoreAmount(upgradeTarget.amount.toString())
                                  }
                                >
                                  Stake {formatTokens(upgradeTarget.amount)} to reach {upgradeTarget.tierName}
                                </Button>
                              )}
                              <Button
                                disabled={
                                  STAKING_SIGNUP_DISABLED ||
                                  stakePending ||
                                  !stakeMoreAmount.trim() ||
                                  Number(stakeMoreAmount) <= 0
                                }
                                size="sm"
                                onClick={handleStakeMore}
                              >
                                {stakePending ? "Sending…" : "Stake more"}
                              </Button>
                            </div>
                          </div>
                        )}
                        {stakedLock && (
                          <p className="text-xs text-muted-foreground">
                            Change membership to 12 months by staking more below
                            and selecting 12 months.{" "}
                            <Button
                              className="h-auto p-0 text-xs font-medium underline underline-offset-2"
                              onClick={() => {
                                setStakeDuration("12m");
                                scrollToCTA();
                              }}
                              type="button"
                              variant="link"
                            >
                              Change membership to 12 months
                            </Button>
                          </p>
                        )}
                        {currentTierFromStake === 3 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-medium text-foreground">
                              Unstake (Tier 3)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Input
                                className="font-mono max-w-[140px]"
                                min={0}
                                onChange={(e) => setUnstakeAmount(e.target.value)}
                                placeholder="Amount"
                                step="any"
                                type="number"
                                value={unstakeAmount}
                              />
                              <Button
                                onClick={() =>
                                  setUnstakeAmount(stakedBalanceDisplay)
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Max
                              </Button>
                              <Button
                                disabled={
                                  unstakePending ||
                                  !unstakeAmount.trim() ||
                                  Number(unstakeAmount) <= 0 ||
                                  Number(unstakeAmount) > Number(stakedBalanceDisplay)
                                }
                                onClick={handleUnstake}
                                size="sm"
                                variant="secondary"
                              >
                                {unstakePending ? "Sending…" : "Unstake"}
                              </Button>
                            </div>
                            {Number(unstakeAmount) > Number(stakedBalanceDisplay) && (
                              <p className="text-xs text-destructive">
                                Amount exceeds staked balance
                              </p>
                            )}
                          </div>
                        )}
                        {stakedLock && !stakedLock.isLocked && (
                          <div className="space-y-2 border-t pt-3">
                            <p className="text-xs font-medium text-foreground">
                              Restake (lock for another period)
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Your lock has ended. Restake to lock again for 30 days or 12 months.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                className="font-mono max-w-[140px]"
                                disabled={STAKING_SIGNUP_DISABLED}
                                min={0}
                                onChange={(e) => setRestakeAmount(e.target.value)}
                                placeholder="Amount"
                                step="any"
                                type="number"
                                value={restakeAmount}
                              />
                              <Button
                                disabled={STAKING_SIGNUP_DISABLED}
                                onClick={() =>
                                  setRestakeAmount(stakedBalanceDisplay)
                                }
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                Max
                              </Button>
                              <div className="flex gap-1">
                                <Button
                                  disabled={STAKING_SIGNUP_DISABLED}
                                  onClick={() => setRestakeDuration("30d")}
                                  size="sm"
                                  type="button"
                                  variant={
                                    restakeDuration === "30d"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  30 days
                                </Button>
                                <Button
                                  disabled={STAKING_SIGNUP_DISABLED}
                                  onClick={() => setRestakeDuration("12m")}
                                  size="sm"
                                  type="button"
                                  variant={
                                    restakeDuration === "12m"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  12 months
                                </Button>
                              </div>
                              <Button
                                disabled={
                                  STAKING_SIGNUP_DISABLED ||
                                  restakePending ||
                                  !restakeAmount.trim() ||
                                  Number(restakeAmount) <= 0 ||
                                  Number(restakeAmount) > Number(stakedBalanceDisplay)
                                }
                                onClick={handleRestake}
                                size="sm"
                              >
                                {restakePending
                                  ? "Sending…"
                                  : `Restake (lock ${restakeDuration === "12m" ? "12 months" : "30 days"})`}
                              </Button>
                            </div>
                            {Number(restakeAmount) > Number(stakedBalanceDisplay) && (
                              <p className="text-xs text-destructive">
                                Amount exceeds staked balance
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Inline tier selector — change tier without scrolling */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Tier
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MEMBERSHIP_TIERS.map((tier) => {
                      const Icon = tier.icon;
                      const isSelected = selectedTier === tier.id;
                      return (
                        <button
                          className={cn(
                            `
                              flex items-center gap-1.5 rounded-lg border-2 px-3
                              py-2 text-sm font-medium transition-all
                            `,
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : `
                                border-border bg-background
                                text-muted-foreground
                                hover:border-muted-foreground/40
                                hover:text-foreground
                              `,
                          )}
                          key={tier.id}
                          onClick={() => setSelectedTier(tier.id)}
                          type="button"
                        >
                          <Icon className="h-4 w-4" />
                          {tier.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    Staking Duration
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={cn(
                        `
                          rounded-lg border-2 px-3 py-2.5 text-left text-sm
                          transition-all
                        `,
                        stakeDuration === "30d"
                          ? "border-primary bg-primary/5"
                          : `
                            border-border
                            hover:border-muted-foreground/30
                          `,
                      )}
                      onClick={() => setStakeDuration("30d")}
                      type="button"
                    >
                      <span className="font-semibold">30 Days</span>
                      <span className="block text-sm text-muted-foreground">
                        Minimum period
                      </span>
                    </button>
                    <button
                      className={cn(
                        `
                          relative rounded-lg border-2 px-3 py-2.5 text-left
                          text-sm transition-all
                        `,
                        stakeDuration === "12m"
                          ? "border-primary bg-primary/5"
                          : `
                            border-border
                            hover:border-muted-foreground/30
                          `,
                      )}
                      onClick={() => setStakeDuration("12m")}
                      type="button"
                    >
                      <Badge
                        className={`
                        absolute -top-1.5 right-1.5 bg-chart-1 text-[10px]
                        text-white
                      `}
                      >
                        Best Value
                      </Badge>
                      <span className="font-semibold">12 Months</span>
                      <span className="block text-sm text-muted-foreground">
                        14 months of eSIM
                      </span>
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-2 rounded-xl bg-muted/30 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Tokens to Stake
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatTokens(stakeAmount)} {tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lock Duration</span>
                    <span className="font-medium">
                      {stakeDuration === "30d" ? "30 days" : "12 months"}
                    </span>
                  </div>
                </div>

                {selectedTier > 1 &&
                  (() => {
                    const nextTierPrice = tierPriceMap[selectedTier - 1];
                    const extraUsd = nextTierPrice
                      ? nextTierPrice.costUsd -
                        (selectedTierPrice?.costUsd ?? 0)
                      : 0;
                    const extraTokens = nextTierPrice
                      ? nextTierPrice.tokensNeeded - stakeAmount
                      : 0;
                    return (
                      <div
                        className={`
                        flex items-start gap-2 rounded-lg border
                        border-primary/20 bg-primary/5 p-3
                      `}
                      >
                        <TrendingUp
                          className={`
                          mt-0.5 h-4 w-4 shrink-0 text-primary
                        `}
                        />
                        <p className="text-sm font-medium text-foreground">
                          {extraUsd > 0
                            ? `Stake ${formatUsd(extraUsd)} (≈${formatTokens(extraTokens)} ${tokenSymbol}) more for `
                            : "Upgrade to "}
                          {
                            MEMBERSHIP_TIERS.find(
                              (t) => t.id === selectedTier - 1,
                            )?.name
                          }
                          {" — "}
                          {
                            MEMBERSHIP_TIERS.find(
                              (t) => t.id === selectedTier - 1,
                            )?.benefits.esimDetail
                          }
                          {" and "}
                          {MEMBERSHIP_TIERS.find(
                            (t) => t.id === selectedTier - 1,
                          )?.benefits.shippingDetail.toLowerCase()}
                          .
                        </p>
                      </div>
                    );
                  })()}

                <Button
                  className="w-full gap-2 text-base"
                  disabled={STAKING_AVAILABLE_NEXT_HOUR || STAKING_SIGNUP_DISABLED || stakePending}
                  onClick={handleStake}
                  size="lg"
                >
                  <Wallet className="h-5 w-5" />
                  {STAKING_AVAILABLE_NEXT_HOUR
                    ? "Staking will be available in the next hour"
                    : STAKING_SIGNUP_DISABLED
                    ? "Membership signup will be available shortly"
                    : stakePending
                      ? "Preparing transaction…"
                      : wallet
                        ? `Stake ${formatTokens(stakeAmount)} ${tokenSymbol}`
                        : "Connect Wallet & Stake"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Your tokens remain yours. They are locked in a smart contract
                  and returned to your wallet when you unstake.
                </p>
              </div>
            </div>

            {/* Right: Benefits for selected tier */}
            <div className="flex min-w-0 flex-1 flex-col">
              <h3
                className={`
                font-display mb-4 text-lg font-semibold text-foreground
              `}
              >
                Your benefits
              </h3>
              <div
                className={cn(
                  `
                    flex flex-1 flex-col rounded-2xl border border-border
                    bg-card p-6
                  `,
                  selectedTierData.accentBorder,
                  selectedTierData.accentBg,
                )}
              >
                {/* eSIM graphic */}
                <div
                  className={`
                  mb-5 flex items-center justify-center rounded-xl border
                  border-border/60 bg-muted/30 py-6
                `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`
                      flex h-16 w-16 items-center justify-center rounded-2xl
                      bg-primary/10
                    `}
                    >
                      <Globe className="h-8 w-8 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      eSIM included
                    </span>
                  </div>
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      `
                        flex h-12 w-12 shrink-0 items-center justify-center
                        rounded-xl
                      `,
                      selectedTierData.accentBg,
                    )}
                  >
                    <selectedTierData.icon
                      className={cn("h-6 w-6", selectedTierData.accent)}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedTierData.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTierData.tagline}
                    </p>
                  </div>
                </div>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong>eSIM:</strong>{" "}
                      {selectedTierData.benefits.esimDetail}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <strong>Shipping:</strong>{" "}
                      {selectedTierData.benefits.shippingDetail}
                    </span>
                  </li>
                  {selectedTierData.benefits.extras.map((extra) => (
                    <li className="flex items-start gap-2" key={extra}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{extra}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* How It Works */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={`
              font-display text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three simple steps to unlock your membership benefits.
            </p>
          </div>

          <div
            className={`
            mx-auto mt-12 grid max-w-4xl gap-8
            md:grid-cols-3
          `}
          >
            {[
              {
                desc: `Connect your Solana wallet that holds ${tokenSymbol} tokens.`,
                icon: Wallet,
                step: "01",
                title: "Connect Wallet",
              },
              {
                desc: `Pick a tier and stake the required ${tokenSymbol} tokens for 30 days or 12 months.`,
                icon: TrendingUp,
                step: "02",
                title: "Choose & Stake",
              },
              {
                desc: "Instantly access your membership perks—eSIM discounts, shipping benefits, and more.",
                icon: Sparkles,
                step: "03",
                title: "Unlock Benefits",
              },
            ].map(({ desc, icon: Icon, step, title }) => (
              <div
                className="relative flex flex-col items-center text-center"
                key={step}
              >
                <span className="mb-3 text-5xl font-black text-primary/10">
                  {step}
                </span>
                <div
                  className={`
                  mb-4 flex h-14 w-14 items-center justify-center rounded-2xl
                  bg-primary/10
                `}
                >
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Why members get more (economies of scale) */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div
            className={`
            mx-auto max-w-3xl overflow-hidden rounded-2xl border
            border-border bg-card p-8 shadow-sm
            md:p-10
          `}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h2
              className={`
              mt-4 font-display text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              {MEMBERSHIP_HOW_IT_WORKS.heading}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {MEMBERSHIP_HOW_IT_WORKS.subheading}
            </p>
            <p className="mt-4 text-muted-foreground">
              {MEMBERSHIP_HOW_IT_WORKS.body}
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Staking cost by community size */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div className="mx-auto max-w-4xl">
            <h2
              className={`
              font-display text-center text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              Staking cost by community size
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Membership stakes are tied to how many members have already joined.
              The table below shows the USD value to stake for each tier at
              different community sizes.
            </p>

            <div className="mt-10 overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px] bg-muted/30">
                      Stakers (per tier)
                    </TableHead>
                    <TableHead className="text-center">Tier 3</TableHead>
                    <TableHead className="text-center">Tier 2</TableHead>
                    <TableHead className="text-center">Tier 1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      First 100 stakers
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $25
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $50
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $100
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">101–250 stakers</TableCell>
                    <TableCell className="text-center tabular-nums">
                      $50
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $100
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $200
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">251–750 stakers</TableCell>
                    <TableCell className="text-center tabular-nums">
                      $100
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $200
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $400
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">750+ stakers</TableCell>
                    <TableCell className="text-center tabular-nums">
                      $200
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $400
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      $800
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-muted-foreground">
              We structure it this way to reward early members who share our
              vision and choose to support us from the start. They commit more
              tokens and lock them for their chosen period, so they get access
              at a lower dollar cost. As the community grows, staking
              requirements increase—so joining earlier pays off.
            </p>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Tier Cards */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          scroll-mt-20 py-16
          md:py-20
        `}
          id="tiers"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2
                className={`
                font-display text-2xl font-semibold text-foreground
                md:text-3xl
              `}
              >
                Choose Your Tier
              </h2>
            </div>

            <div
              className={`
              mt-12 grid gap-6
              sm:grid-cols-2
              lg:grid-cols-3
            `}
            >
            {MEMBERSHIP_TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selectedTier === tier.id;
              const tierPrice = tierPriceMap[tier.id];

              return (
                <Card
                  aria-label={`Select ${tier.name}`}
                  aria-pressed={isSelected}
                  className={cn(
                    `
                      relative cursor-pointer transition-all duration-200
                      hover:shadow-lg
                    `,
                    isSelected
                      ? `
                        shadow-lg ring-2 ring-primary
                        ${tier.accentBorder}
                      `
                      : `
                        border-border
                        hover:-translate-y-1
                      `,
                    tier.popular && "lg:scale-[1.02]",
                  )}
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTier(tier.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge
                        className={`
                        gap-1 bg-primary px-3 py-0.5 text-primary-foreground
                      `}
                      >
                        <Sparkles className="h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div
                      className={cn(
                        `
                          mb-2 flex h-12 w-12 items-center justify-center
                          rounded-xl
                        `,
                        tier.accentBg,
                      )}
                    >
                      <Icon className={cn("h-6 w-6", tier.accent)} />
                    </div>
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.tagline}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Staking requirement */}
                    <div>
                      {pricingLoading ? (
                        <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                      ) : tierPrice ? (
                        <>
                          <p
                            className={`
                            text-2xl font-bold text-foreground tabular-nums
                          `}
                          >
                            {formatUsd(tierPrice.costUsd)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ≈ {formatTokens(tierPrice.tokensNeeded)}{" "}
                            {tokenSymbol} to stake
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Price unavailable
                        </p>
                      )}
                    </div>

                    {/* Key benefits */}
                    <div className="space-y-2.5 border-t pt-4">
                      <div className="flex items-start gap-2">
                        <Smartphone
                          className={cn("mt-0.5 h-4 w-4 shrink-0", tier.accent)}
                        />
                        <span className="text-sm text-foreground">
                          {tier.benefits.esim}
                          <span className="text-muted-foreground">
                            {tier.benefits.esim.toLowerCase().includes("esim")
                              ? " cards"
                              : " eSIM cards"}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Truck
                          className={cn("mt-0.5 h-4 w-4 shrink-0", tier.accent)}
                        />
                        <span className="text-sm text-foreground">
                          {tier.benefits.shipping}
                          <span className="text-muted-foreground">
                            {" "}
                            shipping
                          </span>
                        </span>
                      </div>
                      {tier.benefits.extras
                        .filter(
                          (e) =>
                            e !== "Community access" &&
                            e !== "Governance voting",
                        )
                        .map((extra) => (
                          <div className="flex items-start gap-2" key={extra}>
                            <Check
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0",
                                tier.accent,
                              )}
                            />
                            <span className="text-sm text-muted-foreground">
                              {extra}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* Select CTA */}
                    <Button
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTier(tier.id);
                        scrollToCTA();
                      }}
                      variant={isSelected ? "default" : "outline"}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Lifetime Membership NFT */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div
            className={`
            mx-auto max-w-3xl overflow-hidden rounded-2xl border-2
            border-primary/20 bg-gradient-to-br from-primary/5 via-card
            to-primary/5 p-8
            md:p-10
          `}
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2
              className={`
              font-display text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              Lifetime Membership NFT
            </h2>
            <p className="mt-3 text-muted-foreground">
              Early stakers can mint a Lifetime Membership NFT—a permanent pass
              to full membership benefits, including a free data plan for life
              while you hold it.
            </p>

            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-border bg-card/50 p-5">
                <h3 className="font-semibold text-foreground">
                  Path 1: First 11 stakers (30-day lock)
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  The first 11 members who stake for 30 days are eligible to
                  mint a Lifetime Membership NFT. While you hold the NFT, you
                  keep full membership—including a free eSIM data plan for life.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card/50 p-5">
                <h3 className="font-semibold text-foreground">
                  Path 2: First 100 stakers (12-month lock)
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  The first 100 members who stake for 12 months are eligible to
                  mint a Lifetime Membership NFT. This NFT is transferrable and
                  resellable—you can sell or gift it, and the new holder gets
                  the same lifetime benefits.
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Minting opens within 14 days of eligibility. Mint cost: 1 SOL.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Hold the NFT to keep full membership and free data for life.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Benefits Comparison Table */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={`
              font-display text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              Compare Benefits
            </h2>
            <p className="mt-3 text-muted-foreground">
              A detailed look at what each tier unlocks.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px] bg-muted/30">
                    Benefit
                  </TableHead>
                  {MEMBERSHIP_TIERS.map((tier) => {
                    const Icon = tier.icon;
                    return (
                      <TableHead
                        className={cn(
                          "min-w-[120px] text-center",
                          selectedTier === tier.id && "bg-primary/5",
                        )}
                        key={tier.id}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={cn("h-4 w-4", tier.accent)} />
                          <span>{tier.name}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Staking requirement row */}
                <TableRow className="bg-muted/20">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      Stake Required
                    </div>
                  </TableCell>
                  {MEMBERSHIP_TIERS.map((tier) => {
                    const tp = tierPriceMap[tier.id];
                    return (
                      <TableCell
                        className={cn(
                          "text-center font-medium tabular-nums",
                          selectedTier === tier.id && "bg-primary/5",
                        )}
                        key={tier.id}
                      >
                        {tp ? (
                          <div>
                            <div>{formatUsd(tp.costUsd)}</div>
                            <div
                              className={`
                              text-sm font-normal text-muted-foreground
                            `}
                            >
                              ≈ {formatTokens(tp.tokensNeeded)} {tokenSymbol}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {MEMBERSHIP_BENEFIT_ROWS.map((row) => {
                  const Icon = row.icon;
                  return (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {row.label}
                        </div>
                      </TableCell>
                      {MEMBERSHIP_TIERS.map((tier) => {
                        const val = row.values[tier.id];
                        return (
                          <TableCell
                            className={cn(
                              "text-center",
                              selectedTier === tier.id && "bg-primary/5",
                            )}
                            key={tier.id}
                          >
                            {val === true ? (
                              <Check className="mx-auto h-5 w-5 text-primary" />
                            ) : val === false ? (
                              <Minus
                                className={`
                                mx-auto h-5 w-5 text-muted-foreground/40
                              `}
                              />
                            ) : (
                              <span className="text-sm font-medium">{val}</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* eSIM Spotlight */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div
            className={`
            overflow-hidden rounded-2xl border border-border bg-gradient-to-br
            from-card via-card to-muted/30
          `}
          >
            <div
              className={`
              grid gap-0
              md:grid-cols-2
            `}
            >
              {/* Left: content */}
              <div
                className={`
                flex flex-col justify-center p-8
                md:p-12
              `}
              >
                <Badge className="mb-4 w-fit gap-1.5" variant="secondary">
                  <Globe className="h-3.5 w-3.5" />
                  eSIM Included
                </Badge>
                <h2
                  className={`
                  font-display text-2xl font-semibold text-foreground
                  md:text-3xl
                `}
                >
                  Stay connected everywhere
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Every membership tier includes eSIM benefits. From 25% off at
                  Tier 3 to free eSIM and free shipping at Tier 1—stay connected in
                  200+ countries without hunting for local SIM cards.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Instant activation—no physical SIM needed",
                    "Coverage in 200+ countries and regions",
                    "Flexible data plans from 1GB to unlimited",
                    "Stake 12 months, get 14 months of eSIM coverage",
                  ].map((item) => (
                    <li className="flex items-start gap-3" key={item}>
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link href="/esim">
                    <Button className="gap-2" variant="outline">
                      Explore eSIM Plans
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: visual grid */}
              <div
                className={`
                flex items-center justify-center bg-muted/20 p-8
                md:p-12
              `}
              >
                <div className="grid w-full max-w-xs grid-cols-2 gap-4">
                  {MEMBERSHIP_TIERS.map((tier) => {
                    const Icon = tier.icon;
                    return (
                      <div
                        className={cn(
                          `
                            flex flex-col items-center gap-2 rounded-xl border
                            p-4 text-center transition-colors
                          `,
                          selectedTier === tier.id
                            ? `
                              ${tier.accentBorder}
                              ${tier.accentBg}
                            `
                            : "border-border/50 bg-card/50",
                        )}
                        key={tier.id}
                      >
                        <Icon className={cn("h-5 w-5", tier.accent)} />
                        <p className="text-sm font-medium text-foreground">
                          {tier.name}
                        </p>
                        <p className={cn("text-sm font-semibold", tier.accent)}>
                          {tier.benefits.esim}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* 12 Month Incentive */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div
            className={`
            mx-auto max-w-4xl overflow-hidden rounded-2xl border-2
            border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10
            to-primary/5
          `}
          >
            <div
              className={`
              p-8 text-center
              md:p-12
            `}
            >
              <div
                className={`
                mx-auto mb-6 flex h-16 w-16 items-center justify-center
                rounded-full bg-primary/10
              `}
              >
                <Timer className="h-8 w-8 text-primary" />
              </div>
              <h2
                className={`
                font-display text-2xl font-semibold text-foreground
                md:text-3xl
              `}
              >
                Stake 12 Months, Get 14 Months of eSIM
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Commit to a 12-month stake and we&apos;ll extend your eSIM
                benefits to 14 months—that&apos;s 2 extra months completely
                free. Your membership benefits, shipping discounts, and
                everything else stay active for the full staking period.
              </p>

              <div
                className={`
                mx-auto mt-10 grid max-w-lg gap-6
                sm:grid-cols-2
              `}
              >
                <div
                  aria-pressed={stakeDuration === "30d"}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 p-6 transition-all",
                    stakeDuration === "30d"
                      ? "border-primary bg-card shadow-md"
                      : `
                        border-border bg-card/50
                        hover:border-border/80
                      `,
                  )}
                  onClick={() => setStakeDuration("30d")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStakeDuration("30d");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <p className="text-3xl font-bold text-foreground">30</p>
                  <p className="text-sm font-medium text-muted-foreground">
                    days
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Minimum staking period. Great for trying out your tier.
                  </p>
                </div>
                <div
                  aria-pressed={stakeDuration === "12m"}
                  className={cn(
                    `
                      relative cursor-pointer rounded-xl border-2 p-6
                      transition-all
                    `,
                    stakeDuration === "12m"
                      ? "border-primary bg-card shadow-md"
                      : `
                        border-border bg-card/50
                        hover:border-border/80
                      `,
                  )}
                  onClick={() => setStakeDuration("12m")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStakeDuration("12m");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="absolute -top-2.5 right-3">
                    <Badge className="gap-1 bg-chart-1 text-white">
                      +2 months free
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-foreground">12</p>
                  <p className="text-sm font-medium text-muted-foreground">
                    months
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Get 14 months of eSIM coverage. Best value for committed
                    members.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Dynamic Pricing Explainer */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className={`
              font-display text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              Dynamic Staking Requirements
            </h2>
            <p className="mt-3 text-muted-foreground">
              Staking thresholds adjust automatically based on two factors,
              keeping membership fair and accessible.
            </p>
          </div>

          <div
            className={`
            mx-auto mt-12 grid max-w-3xl gap-8
            md:grid-cols-2
          `}
          >
            <Card className="border-border">
              <CardHeader>
                <div
                  className={`
                  mb-2 flex h-10 w-10 items-center justify-center rounded-lg
                  bg-primary/10
                `}
                >
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Token Price</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  As the {tokenSymbol} token price (market cap) increases, the
                  number of tokens required to stake decreases proportionally—so
                  the dollar value of membership stays reasonable.
                </CardDescription>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader>
                <div
                  className={`
                  mb-2 flex h-10 w-10 items-center justify-center rounded-lg
                  bg-primary/10
                `}
                >
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Staker Count</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">
                  Similar to a bonding curve, the more people already staked at
                  a tier, the slightly higher the threshold becomes. Early
                  members benefit from lower requirements.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Claim Free eSIM (Tier 1) */}
        {/* --------------------------------------------------------------- */}
        {wallet && (claimEligible || claimAlreadyClaimed) && (
          <section
            className={`
            py-16
            md:py-20
          `}
          >
            <div className="mx-auto max-w-4xl">
              <Card
                className={`
                overflow-hidden border-2 border-primary/30 bg-gradient-to-br
                from-primary/5 via-background to-primary/5
              `}
              >
                <CardHeader className="text-center">
                  <div
                    className={`
                    mx-auto mb-3 flex h-14 w-14 items-center justify-center
                    rounded-full bg-primary/10
                  `}
                  >
                    <Smartphone className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="font-display text-2xl">
                    {claimAlreadyClaimed
                      ? "eSIM Claimed"
                      : "Claim Your Free eSIM"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {claimAlreadyClaimed
                      ? claimSuccess
                        ? "Your free eSIM has been provisioned. Activate it in your dashboard or check your email for the link."
                        : "You've already claimed your free eSIM for this staking period. Visit your eSIM dashboard to manage and activate it."
                      : `As a Tier ${claimTier} member, you can claim one 30-day eSIM at no cost. Pick data-only or data with minutes + SMS, then click Claim to activate.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 pb-8">
                  {claimAlreadyClaimed ? (
                    <Button
                      asChild
                      className="gap-2"
                      size="lg"
                      variant="outline"
                    >
                      <Link href="/dashboard/esim">
                        <Globe className="h-5 w-5" />
                        Activate My eSIM
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <div className="flex w-full flex-wrap items-center justify-center gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Plan:
                          </span>
                          <Button
                            onClick={() => setStakerClaimPackageType("DATA-ONLY")}
                            size="sm"
                            variant={
                              stakerClaimPackageType === "DATA-ONLY"
                                ? "default"
                                : "outline"
                            }
                          >
                            <Wifi className="mr-1 h-4 w-4" />
                            Data only
                          </Button>
                          <Button
                            onClick={() =>
                              setStakerClaimPackageType("DATA-VOICE-SMS")
                            }
                            size="sm"
                            variant={
                              stakerClaimPackageType === "DATA-VOICE-SMS"
                                ? "default"
                                : "outline"
                            }
                          >
                            <Signal className="mr-1 h-4 w-4" />
                            Data + minutes + SMS
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Country:
                          </span>
                          <select
                            aria-label="Choose country for eSIM"
                            className={cn(
                              "min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                            )}
                            disabled={esimCountriesLoading}
                            value={stakerClaimCountryId}
                            onChange={(e) =>
                              setStakerClaimCountryId(e.target.value)
                            }
                          >
                            <option value="">Global</option>
                            {esimCountries.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {stakerClaimPackagesLoading ? (
                        <p className="text-muted-foreground">
                          Loading eSIM plans…
                        </p>
                      ) : stakerClaimPackages.length > 0 ? (
                        <>
                          <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {stakerClaimPackages.map((pkg) => (
                              <Card
                                key={pkg.id}
                                className="flex flex-col border border-border bg-card"
                              >
                                <CardHeader className="pb-2">
                                  <CardTitle className="font-display text-lg">
                                    {formatEsimPackageName(pkg.name)}
                                  </CardTitle>
                                  <CardDescription>
                                    {pkg.data_quantity} {pkg.data_unit} · 30
                                    days
                                    {pkg.has5g ? " · 5G" : ""}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="mt-auto pt-0">
                                  <Button
                                    className="w-full gap-2"
                                    disabled={claimPending}
                                    onClick={() => handleClaimEsim(pkg.id)}
                                    size="sm"
                                  >
                                    <Smartphone className="h-4 w-4" />
                                    Claim
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          <p className="text-center text-sm text-muted-foreground">
                            One claim per staking period. After claiming, you can
                            activate your eSIM in your dashboard.
                          </p>
                        </>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* --------------------------------------------------------------- */}
        {/* FAQ */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16
          md:py-20
        `}
        >
          <div className="mx-auto max-w-3xl">
            <h2
              className={`
              font-display text-center text-2xl font-semibold text-foreground
              md:text-3xl
            `}
            >
              Frequently Asked Questions
            </h2>

            <div className="mt-10 space-y-0 rounded-xl border border-border">
              {MEMBERSHIP_FAQ.map(({ a, q }) => (
                <details
                  className={`
                    group border-b border-border
                    last:border-b-0
                    [&[open]_svg]:rotate-180
                  `}
                  key={q}
                >
                  <summary
                    className={`
                    flex cursor-pointer list-none items-center justify-between
                    gap-2 px-6 py-5 font-medium text-foreground
                    transition-colors
                    hover:text-primary
                    [&::-webkit-details-marker]:hidden
                  `}
                  >
                    <span>{q}</span>
                    <ChevronDown
                      className={`
                      h-5 w-5 shrink-0 text-muted-foreground
                      transition-transform
                    `}
                    />
                  </summary>
                  <p className="px-6 pr-12 pb-5 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Final CTA */}
        {/* --------------------------------------------------------------- */}
        <section
          className={`
          py-16 text-center
          md:py-20
        `}
        >
          <h2
            className={`
            font-display text-2xl font-semibold text-foreground
            md:text-3xl
          `}
          >
            Ready to Join?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Stake {tokenSymbol} today and start enjoying exclusive membership
            benefits. The earlier you join, the lower the staking threshold.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button className="gap-2" onClick={scrollToCTA} size="lg">
              Stake Now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/token">
              <Button className="gap-2" size="lg" variant="outline">
                Learn About CULT
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Disclaimer */}
        {/* --------------------------------------------------------------- */}
        <section className="space-y-4 border-t border-border py-12">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Disclaimer:</strong> Membership
            tiers, staking requirements, and benefits are subject to change as
            the ecosystem evolves.
          </p>
          <p className="text-sm text-muted-foreground">
            The {tokenSymbol} token is a utility token. There is no guarantee of
            financial return. The value of staked tokens may fluctuate. Token
            holders participate at their own risk. This is not financial, legal,
            or investment advice.
          </p>
        </section>
      </div>
    </div>
  );
}
