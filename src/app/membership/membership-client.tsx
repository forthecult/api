"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  Globe,
  Minus,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { LOCK_12_MONTHS, LOCK_30_DAYS } from "~/lib/cult-staking";
import { cn } from "~/lib/cn";
import { formatMarketCap, formatTokens, formatUsd } from "~/lib/format";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

import { useStakeTransaction } from "~/hooks/use-stake-transaction";

// ---------------------------------------------------------------------------
// Live pricing types
// ---------------------------------------------------------------------------

/** Shape of the /api/governance/token-price response */
interface TokenPriceResponse {
  status: boolean;
  data?: {
    token: { symbol: string; mint: string; decimals: number; priceUsd: number };
    market: {
      marketCapUsd: number;
      volume24hUsd: number;
      liquidityUsd: number;
    };
    staking: { stakerCount: number; programConfigured: boolean };
    pricing: {
      bracket: string;
      tiers: {
        tierId: number;
        costUsd: number;
        tokensNeeded: number;
        tokensRaw: string;
      }[];
    };
    fetchedAt: number;
  };
}

export function MembershipClient() {
  const [selectedTier, setSelectedTier] = useState<number>(2);
  const [stakeDuration, setStakeDuration] = useState<"30d" | "12m">("30d");

  // eSIM claim state
  const [claimEligible, setClaimEligible] = useState(false);
  const [claimAlreadyClaimed, setClaimAlreadyClaimed] = useState(false);
  const [claimTier, setClaimTier] = useState<number | null>(null);
  const [claimPending, setClaimPending] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Live pricing state
  const [pricingData, setPricingData] = useState<
    TokenPriceResponse["data"] | null
  >(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  const { wallet, openConnectModal, stake, stakePending } =
    useStakeTransaction();

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
          eligible?: boolean;
          claimed?: boolean;
          tier?: number | null;
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

  // Derive pricing for the selected tier
  const tokenSymbol = pricingData?.token.symbol ?? "TOKEN";
  const tokenPrice = pricingData?.token.priceUsd ?? 0;
  const marketCap = pricingData?.market.marketCapUsd ?? 0;
  const pricingBracket = pricingData?.pricing.bracket ?? "";

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
    await stake(stakeAmount.toString(), lockDuration);
  }, [stake, stakeAmount, lockDuration]);

  // ------ eSIM Claim handler ------
  const handleClaimEsim = useCallback(async () => {
    if (!wallet) {
      toast.error("Connect your wallet first");
      return;
    }
    setClaimPending(true);
    try {
      const res = await fetch("/api/esim/membership-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          // Use a well-known global 1GB/30-day data-only package as the default free SIM
          // This can be swapped for a configurable package later
          packageId: "esim-free-tier2-default",
        }),
      });
      const data = (await res.json()) as {
        status: boolean;
        message?: string;
        data?: { message?: string };
      };
      if (!res.ok || !data.status) {
        toast.error(data.message ?? "Failed to claim eSIM");
        return;
      }
      setClaimSuccess(true);
      setClaimAlreadyClaimed(true);
      toast.success(
        data.data?.message ??
          "Free eSIM claimed! Check your email for activation.",
      );
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setClaimPending(false);
    }
  }, [wallet]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-muted/50 via-background to-background">
      {/* ----------------------------------------------------------------- */}
      {/* Hero */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute inset-0 -top-32 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, var(--primary) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="container relative z-10 mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" />
            Membership
          </Badge>

          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Join the{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Cult
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Stake {tokenSymbol} to unlock exclusive membership benefits. Free
            eSIM cards, free shipping, member-only discounts, and more. The
            longer you stake, the more you save.
          </p>

          {/* Live market data bar */}
          {pricingData && (
            <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">
                  {tokenSymbol}
                </span>{" "}
                {formatUsd(tokenPrice)}
              </span>
              <span className="hidden sm:inline text-border">|</span>
              <span>MC {formatMarketCap(marketCap)}</span>
              <span className="hidden sm:inline text-border">|</span>
              <span className="text-sm">{pricingBracket}</span>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2" onClick={scrollToTiers}>
              View Tiers
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/esim">
              <Button size="lg" variant="outline" className="gap-2">
                <Globe className="h-4 w-4" />
                Browse eSIM Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* --------------------------------------------------------------- */}
        {/* Stake & Join — below the fold, left card + right benefits */}
        {/* --------------------------------------------------------------- */}
        <section id="stake-cta" className="scroll-mt-20 py-16 md:py-20">
          <div className="flex flex-col gap-8 md:flex-row md:gap-10">
            {/* Left: Stake card */}
            <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl md:w-1/2 md:shrink-0">
              <div className="border-b bg-muted/30 px-6 py-5">
                <h2 className="font-display text-xl font-semibold text-foreground md:text-2xl">
                  Stake {tokenSymbol} &amp; Join
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select your tier and duration, then connect your wallet to
                  stake.
                </p>
              </div>

              <div className="space-y-5 p-6">
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
                          key={tier.id}
                          type="button"
                          onClick={() => setSelectedTier(tier.id)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                          )}
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
                      type="button"
                      className={cn(
                        "rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all",
                        stakeDuration === "30d"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30",
                      )}
                      onClick={() => setStakeDuration("30d")}
                    >
                      <span className="font-semibold">30 Days</span>
                      <span className="block text-sm text-muted-foreground">
                        Minimum period
                      </span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "relative rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all",
                        stakeDuration === "12m"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30",
                      )}
                      onClick={() => setStakeDuration("12m")}
                    >
                      <Badge className="absolute -top-1.5 right-1.5 bg-chart-1 text-[10px] text-white">
                        Best Value
                      </Badge>
                      <span className="font-semibold">12 Months</span>
                      <span className="block text-sm text-muted-foreground">
                        14 months eSIM
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
                      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
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
                  size="lg"
                  className="w-full gap-2 text-base"
                  onClick={handleStake}
                  disabled={stakePending}
                >
                  <Wallet className="h-5 w-5" />
                  {stakePending
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
              <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
                Your benefits
              </h3>
              <div
                className={cn(
                  "flex flex-1 flex-col rounded-2xl border border-border bg-card p-6",
                  selectedTierData.accentBorder,
                  selectedTierData.accentBg,
                )}
              >
                {/* eSIM graphic */}
                <div className="mb-5 flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 py-6">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
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
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
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
                    <li key={extra} className="flex items-start gap-2">
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
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three simple steps to unlock your membership benefits.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Wallet,
                title: "Connect Wallet",
                desc: `Connect your Solana wallet that holds ${tokenSymbol} tokens.`,
              },
              {
                step: "02",
                icon: TrendingUp,
                title: "Choose & Stake",
                desc: `Pick a tier and stake the required ${tokenSymbol} tokens for 30 days or 12 months.`,
              },
              {
                step: "03",
                icon: Sparkles,
                title: "Unlock Benefits",
                desc: "Instantly access your membership perks—eSIM discounts, shipping benefits, and more.",
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div
                key={step}
                className="relative flex flex-col items-center text-center"
              >
                <span className="mb-3 text-5xl font-black text-primary/10">
                  {step}
                </span>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
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
        {/* Tier Cards */}
        {/* --------------------------------------------------------------- */}
        <section id="tiers" className="scroll-mt-20 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Choose Your Tier
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MEMBERSHIP_TIERS.map((tier) => {
              const Icon = tier.icon;
              const isSelected = selectedTier === tier.id;
              const tierPrice = tierPriceMap[tier.id];

              return (
                <Card
                  key={tier.id}
                  className={cn(
                    "relative cursor-pointer transition-all duration-200 hover:shadow-lg",
                    isSelected
                      ? `ring-2 ring-primary shadow-lg ${tier.accentBorder}`
                      : "border-border hover:-translate-y-1",
                    tier.popular && "lg:scale-[1.02]",
                  )}
                  onClick={() => setSelectedTier(tier.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTier(tier.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Select ${tier.name}`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="gap-1 bg-primary px-3 py-0.5 text-primary-foreground">
                        <Sparkles className="h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div
                      className={cn(
                        "mb-2 flex h-12 w-12 items-center justify-center rounded-xl",
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
                          <p className="text-2xl font-bold tabular-nums text-foreground">
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
                          <div key={extra} className="flex items-start gap-2">
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
                      variant={isSelected ? "default" : "outline"}
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTier(tier.id);
                        scrollToCTA();
                      }}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Benefits Comparison Table */}
        {/* --------------------------------------------------------------- */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
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
                        key={tier.id}
                        className={cn(
                          "min-w-[120px] text-center",
                          selectedTier === tier.id && "bg-primary/5",
                        )}
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
                        key={tier.id}
                        className={cn(
                          "text-center font-medium tabular-nums",
                          selectedTier === tier.id && "bg-primary/5",
                        )}
                      >
                        {tp ? (
                          <div>
                            <div>{formatUsd(tp.costUsd)}</div>
                            <div className="text-sm font-normal text-muted-foreground">
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
                            key={tier.id}
                            className={cn(
                              "text-center",
                              selectedTier === tier.id && "bg-primary/5",
                            )}
                          >
                            {val === true ? (
                              <Check className="mx-auto h-5 w-5 text-primary" />
                            ) : val === false ? (
                              <Minus className="mx-auto h-5 w-5 text-muted-foreground/40" />
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
        <section className="py-16 md:py-20">
          <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30">
            <div className="grid gap-0 md:grid-cols-2">
              {/* Left: content */}
              <div className="flex flex-col justify-center p-8 md:p-12">
                <Badge variant="secondary" className="mb-4 w-fit gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  eSIM Included
                </Badge>
                <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                  Stay connected everywhere
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Every membership tier includes eSIM benefits. From 10% off at
                  Tier 4 to a premium free eSIM card at Tier 1—stay connected in
                  200+ countries without hunting for local SIM cards.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Instant activation—no physical SIM needed",
                    "Coverage in 200+ countries and regions",
                    "Flexible data plans from 1GB to unlimited",
                    "Stake 12 months, get 14 months of eSIM coverage",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link href="/esim">
                    <Button variant="outline" className="gap-2">
                      Explore eSIM Plans
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: visual grid */}
              <div className="flex items-center justify-center bg-muted/20 p-8 md:p-12">
                <div className="grid w-full max-w-xs grid-cols-2 gap-4">
                  {MEMBERSHIP_TIERS.map((tier) => {
                    const Icon = tier.icon;
                    return (
                      <div
                        key={tier.id}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                          selectedTier === tier.id
                            ? `${tier.accentBorder} ${tier.accentBg}`
                            : "border-border/50 bg-card/50",
                        )}
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
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <div className="p-8 text-center md:p-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Timer className="h-8 w-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
                Stake 12 Months, Get 14 Months of eSIM
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Commit to a 12-month stake and we&apos;ll extend your eSIM
                benefits to 14 months—that&apos;s 2 extra months completely
                free. Your membership benefits, shipping discounts, and
                everything else stay active for the full staking period.
              </p>

              <div className="mx-auto mt-10 grid max-w-lg gap-6 sm:grid-cols-2">
                <div
                  className={cn(
                    "cursor-pointer rounded-xl border-2 p-6 transition-all",
                    stakeDuration === "30d"
                      ? "border-primary bg-card shadow-md"
                      : "border-border bg-card/50 hover:border-border/80",
                  )}
                  onClick={() => setStakeDuration("30d")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStakeDuration("30d");
                    }
                  }}
                  aria-pressed={stakeDuration === "30d"}
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
                  className={cn(
                    "relative cursor-pointer rounded-xl border-2 p-6 transition-all",
                    stakeDuration === "12m"
                      ? "border-primary bg-card shadow-md"
                      : "border-border bg-card/50 hover:border-border/80",
                  )}
                  onClick={() => setStakeDuration("12m")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setStakeDuration("12m");
                    }
                  }}
                  aria-pressed={stakeDuration === "12m"}
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
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Dynamic Staking Requirements
            </h2>
            <p className="mt-3 text-muted-foreground">
              Staking thresholds adjust automatically based on two factors,
              keeping membership fair and accessible.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-8 md:grid-cols-2">
            <Card className="border-border">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
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
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
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
        {/* Claim Free eSIM (Tier 2+) */}
        {/* --------------------------------------------------------------- */}
        {wallet && (claimEligible || claimAlreadyClaimed) && (
          <section className="py-16 md:py-20">
            <div className="mx-auto max-w-2xl">
              <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
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
                        ? "Your free eSIM has been provisioned! Check your email for the activation link or visit your eSIM dashboard."
                        : "You've already claimed your free eSIM for this staking period. Visit your eSIM dashboard to manage it."
                      : `As a Tier ${claimTier} member, you're eligible for a free eSIM card. Claim it now — no payment required.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 pb-8">
                  {claimAlreadyClaimed ? (
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="gap-2"
                    >
                      <Link href="/dashboard/esim">
                        <Globe className="h-5 w-5" />
                        View My eSIMs
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        className="gap-2 text-base"
                        onClick={handleClaimEsim}
                        disabled={claimPending}
                      >
                        <Smartphone className="h-5 w-5" />
                        {claimPending ? "Claiming eSIM…" : "Claim Free eSIM"}
                      </Button>
                      <p className="text-center text-sm text-muted-foreground">
                        Your free eSIM will be provisioned instantly and sent to
                        your email. One claim per staking period.
                      </p>
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
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground md:text-3xl">
              Frequently Asked Questions
            </h2>

            <div className="mt-10 space-y-0 rounded-xl border border-border">
              {MEMBERSHIP_FAQ.map(({ q, a }) => (
                <details
                  key={q}
                  className="group border-b border-border last:border-b-0 [&[open]_svg]:rotate-180"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-6 py-5 font-medium text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                    <span>{q}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform" />
                  </summary>
                  <p className="px-6 pb-5 pr-12 text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        {/* Final CTA */}
        {/* --------------------------------------------------------------- */}
        <section className="py-16 text-center md:py-20">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Ready to Join?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Stake {tokenSymbol} today and start enjoying exclusive membership
            benefits. The earlier you join, the lower the staking threshold.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2" onClick={scrollToCTA}>
              Stake Now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Link href="/token">
              <Button size="lg" variant="outline" className="gap-2">
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
