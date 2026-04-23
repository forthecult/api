"use client";

import {
  ArrowRight,
  Check,
  Globe,
  Shield,
  Signal,
  Smartphone,
  Sparkles,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { formatEsimPackageName } from "~/lib/esim-format";
import { formatTokens } from "~/lib/format";
import { MEMBERSHIP_TIERS } from "~/lib/membership-tiers";
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

type PreviewTier = 1 | 2 | 3;

interface StakerPackage {
  data_quantity: number;
  data_unit: string;
  has5g?: boolean;
  id: string;
  name: string;
  package_type?: string;
  package_validity: number;
  package_validity_unit: string;
}

const MOCK_STAKE: Record<
  PreviewTier,
  { amount: string; timeUntilUnlock: string }
> = {
  1: { amount: "52000", timeUntilUnlock: "12 days until unlock" },
  2: { amount: "18000", timeUntilUnlock: "5 days until unlock" },
  3: { amount: "4000", timeUntilUnlock: "Unlocked" },
};

/**
 * Test page: what the membership page looks like after someone has staked,
 * for Tier 1, Tier 2, and Tier 3 — including "stake more" and unstake widget for Tier 3.
 */
export function MembershipAfterStakeTestClient() {
  const [previewTier, setPreviewTier] = useState<PreviewTier>(1);
  const [packages, setPackages] = useState<StakerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [claimingId, setClaimingId] = useState<null | string>(null);
  const [packageType, setPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >("DATA-ONLY");
  const [countryId, setCountryId] = useState("");
  const [countries, setCountries] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [stakeMoreAmount, setStakeMoreAmount] = useState("");
  const [restakeAmount, setRestakeAmount] = useState("");
  const [restakeDuration, setRestakeDuration] = useState<"12m" | "30d">("30d");

  const tierData = MEMBERSHIP_TIERS.find((t) => t.id === previewTier);
  const mock = MOCK_STAKE[previewTier];

  useEffect(() => {
    fetch("/api/esim/countries")
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as {
          data?: { id: number; name: string }[];
          status: boolean;
        };
        if (data.status && Array.isArray(data.data)) {
          setCountries(
            data.data.slice().sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
      })
      .catch(() => setCountries([]))
      .finally(() => setCountriesLoading(false));
  }, []);

  useEffect(() => {
    if (previewTier !== 1) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("package_type", packageType);
    if (countryId) params.set("country", countryId);
    fetch(`/api/esim/packages/staker-claim?${params.toString()}`)
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as { data?: StakerPackage[]; status: boolean };
        if (data.status && Array.isArray(data.data)) {
          setPackages(data.data);
        } else {
          setPackages([]);
        }
      })
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [previewTier, packageType, countryId]);

  const handleClaim = useCallback((pkgId: string) => {
    setClaimingId(pkgId);
    setTimeout(() => {
      setClaimed(true);
      setClaimingId(null);
      toast.success(
        "Test: Claim recorded. In production you’d activate this eSIM in your dashboard.",
      );
    }, 600);
  }, []);

  const TierIcon = tierData?.icon ?? Shield;

  return (
    <div
      className={`
        flex min-h-screen flex-col bg-gradient-to-b from-muted/50 via-background
        to-background
      `}
    >
      {/* Test banner + tier selector */}
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <div
          className={`
            mx-auto flex max-w-4xl flex-col items-center gap-3
            sm:flex-row sm:justify-between
          `}
        >
          <p
            className={`
              text-center text-sm text-amber-800
              dark:text-amber-200
            `}
          >
            <strong>Test preview:</strong> Membership page after staking. Switch
            tier to see Tier 1, Tier 2 (stake more), or Tier 3 (stake more +
            unstake).{" "}
            <Link className="underline" href="/membership">
              Real membership
            </Link>
          </p>
          <div
            className={`
              flex gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5
              p-1
            `}
          >
            {([1, 2, 3] as const).map((t) => (
              <button
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  previewTier === t
                    ? `
                      bg-amber-500/20 text-amber-900
                      dark:text-amber-100
                    `
                    : `
                      text-amber-800/80
                      hover:bg-amber-500/10
                      dark:text-amber-200/80
                    `,
                )}
                key={t}
                onClick={() => setPreviewTier(t)}
                type="button"
              >
                Tier {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Post-stake hero — varies by tier */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -top-32 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, var(--primary) 0%, transparent 70%)",
          }}
        />
        <div
          className={`
            relative z-10 container mx-auto max-w-5xl px-4 py-16 text-center
            sm:px-6 sm:py-20
            lg:px-8
          `}
        >
          <Badge className="mb-4 gap-1.5 px-3 py-1" variant="secondary">
            <Sparkles className="h-3.5 w-3.5" />
            Membership
          </Badge>
          <h1
            className={`
              font-display text-3xl font-bold tracking-tight text-foreground
              sm:text-4xl
              md:text-5xl
            `}
          >
            You&apos;re in
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            You&apos;ve staked and unlocked membership. You&apos;re on{" "}
            <strong className="text-foreground">
              {tierData?.name ?? `Tier ${previewTier}`}
            </strong>{" "}
            — {tierData?.benefits.esimDetail}.{" "}
            {previewTier === 1 && "Claim your free 30-day eSIM below."}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge className="gap-1.5 px-3 py-1" variant="outline">
              <TierIcon className="h-3.5 w-3.5" />
              {tierData?.name ?? `Tier ${previewTier}`}
            </Badge>
            {previewTier === 1 && (
              <Badge className="gap-1.5 px-3 py-1" variant="outline">
                <Check className="h-3.5 w-3.5 text-green-600" />
                Free eSIM
              </Badge>
            )}
          </div>
          {previewTier !== 1 && (
            <div className="mt-8">
              <Button asChild size="sm" variant="outline">
                <Link href="/esim">
                  <Globe className="mr-2 h-4 w-4" />
                  Browse all eSIM plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Stake card with "Your stake" — same layout as real membership */}
      <section
        className={`
          container mx-auto max-w-7xl px-4 py-8
          sm:px-6
          lg:px-8
        `}
      >
        <div className="mx-auto max-w-2xl">
          <Card
            className={`
              overflow-hidden rounded-2xl border border-border bg-card
            `}
          >
            <div className="border-b bg-muted/30 px-6 py-5">
              <h2
                className={`
                  font-display text-xl font-semibold text-foreground
                  md:text-2xl
                `}
              >
                Upgrade Membership
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Stake CULT to upgrade. Enter an amount or use the button to fill
                the amount needed for the next tier.
              </p>
            </div>
            <div className="space-y-5 p-6">
              {/* Your stake — mock data per tier */}
              <div
                className={`flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4
                `}
              >
                <p className="text-sm font-medium text-foreground">
                  Your stake
                </p>
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatTokens(Number(mock.amount))} CULT
                    </span>
                    <span className="text-muted-foreground">
                      · {tierData?.name ?? `Tier ${previewTier}`}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    30 days · {mock.timeUntilUnlock}
                  </p>
                </div>
                {(previewTier === 2 || previewTier === 3) && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-foreground">
                      Stake CULT to upgrade. Enter an amount or use the button
                      to fill the amount needed for the next tier.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-[140px] font-mono"
                        min={0}
                        onChange={(e) => setStakeMoreAmount(e.target.value)}
                        placeholder="Amount"
                        step="any"
                        type="number"
                        value={stakeMoreAmount}
                      />
                      {previewTier === 2 && (
                        <Button
                          onClick={() =>
                            setStakeMoreAmount(
                              String(
                                Number(MOCK_STAKE[1].amount) -
                                  Number(MOCK_STAKE[2].amount),
                              ),
                            )
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Stake {formatTokens(52000 - 18000)} to reach Tier 1
                        </Button>
                      )}
                      {previewTier === 3 && (
                        <Button
                          onClick={() =>
                            setStakeMoreAmount(
                              String(
                                Number(MOCK_STAKE[2].amount) -
                                  Number(MOCK_STAKE[3].amount),
                              ),
                            )
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Stake {formatTokens(18000 - 4000)} to reach Tier 2
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          toast.info(
                            "Test: Use the real membership page with a connected wallet to stake more.",
                          )
                        }
                        size="sm"
                      >
                        Stake more
                      </Button>
                    </div>
                  </div>
                )}
                {/* Restake — shown when lock expired (Tier 3 mock is "Unlocked") */}
                {previewTier === 3 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-foreground">
                      Restake (lock for another period)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your lock has ended. Restake to lock again for 30 days or
                      12 months.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-[140px] font-mono"
                        min={0}
                        onChange={(e) => setRestakeAmount(e.target.value)}
                        placeholder="Amount"
                        step="any"
                        type="number"
                        value={restakeAmount}
                      />
                      <Button
                        onClick={() => setRestakeAmount(MOCK_STAKE[3].amount)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Max
                      </Button>
                      <div className="flex rounded-md border border-input">
                        <Button
                          className="rounded-r-none border-0"
                          onClick={() => setRestakeDuration("30d")}
                          size="sm"
                          type="button"
                          variant={
                            restakeDuration === "30d" ? "secondary" : "ghost"
                          }
                        >
                          30 days
                        </Button>
                        <Button
                          className="rounded-l-none border-0"
                          onClick={() => setRestakeDuration("12m")}
                          size="sm"
                          type="button"
                          variant={
                            restakeDuration === "12m" ? "secondary" : "ghost"
                          }
                        >
                          12 months
                        </Button>
                      </div>
                      <Button
                        onClick={() =>
                          toast.info(
                            "Test: Restake is only available on the real membership page with a connected wallet.",
                          )
                        }
                        size="sm"
                      >
                        Restake (lock{" "}
                        {restakeDuration === "12m" ? "12 months" : "30 days"})
                      </Button>
                    </div>
                  </div>
                )}
                {previewTier === 3 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-foreground">
                      Unstake (Tier 3)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="max-w-[140px] font-mono"
                        min={0}
                        onChange={(e) => setUnstakeAmount(e.target.value)}
                        placeholder="Amount"
                        step="any"
                        type="number"
                        value={unstakeAmount}
                      />
                      <Button
                        onClick={() => setUnstakeAmount(MOCK_STAKE[3].amount)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Max
                      </Button>
                      <Button
                        onClick={() =>
                          toast.info(
                            "Test: Unstake is only available on the real membership page with a connected wallet.",
                          )
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Unstake
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Claim Free eSIM — Tier 1 only */}
      {previewTier === 1 && (
        <section
          className={`
            container mx-auto max-w-7xl px-4 py-16
            sm:px-6
            md:py-20
            lg:px-8
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
                  {claimed ? "eSIM Claimed" : "Claim Your Free eSIM"}
                </CardTitle>
                <CardDescription className="text-base">
                  {claimed
                    ? "Your free eSIM has been provisioned. Activate it in your dashboard or check your email for the link."
                    : "As a Tier 1 member, you can claim one 30-day eSIM at no cost. Pick data-only or data with minutes + SMS, then click Claim to activate."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 pb-8">
                {claimed ? (
                  <Button asChild className="gap-2" size="lg" variant="outline">
                    <Link href="/dashboard/esim">
                      <Globe className="h-5 w-5" />
                      Activate My eSIM
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <div
                      className={`
                        flex w-full flex-wrap items-center justify-center gap-4
                      `}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Plan:
                        </span>
                        <Button
                          onClick={() => setPackageType("DATA-ONLY")}
                          size="sm"
                          variant={
                            packageType === "DATA-ONLY" ? "default" : "outline"
                          }
                        >
                          <Wifi className="mr-1 h-4 w-4" />
                          Data only
                        </Button>
                        <Button
                          onClick={() => setPackageType("DATA-VOICE-SMS")}
                          size="sm"
                          variant={
                            packageType === "DATA-VOICE-SMS"
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
                            `
                              min-w-[180px] rounded-md border border-input
                              bg-background px-3 py-2 text-sm
                            `,
                          )}
                          disabled={countriesLoading}
                          onChange={(e) => setCountryId(e.target.value)}
                          value={countryId}
                        >
                          <option value="">Global</option>
                          {countries.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {loading ? (
                      <p className="text-muted-foreground">
                        Loading eSIM plans…
                      </p>
                    ) : packages.length > 0 ? (
                      <>
                        <div
                          className={`
                            grid w-full gap-4
                            sm:grid-cols-2
                            lg:grid-cols-3
                          `}
                        >
                          {packages.map((pkg) => (
                            <Card
                              className={`
                                flex flex-col border border-border bg-card
                              `}
                              key={pkg.id}
                            >
                              <CardHeader className="pb-2">
                                <CardTitle className="font-display text-lg">
                                  {formatEsimPackageName(pkg.name)}
                                </CardTitle>
                                <CardDescription>
                                  {pkg.data_quantity} {pkg.data_unit} · 30 days
                                  {pkg.has5g ? " · 5G" : ""}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="mt-auto pt-0">
                                <Button
                                  className="w-full gap-2"
                                  disabled={claimingId !== null}
                                  onClick={() => handleClaim(pkg.id)}
                                  size="sm"
                                >
                                  <Smartphone className="h-4 w-4" />
                                  {claimingId === pkg.id
                                    ? "Claiming…"
                                    : "Claim"}
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
    </div>
  );
}
