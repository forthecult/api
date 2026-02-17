"use client";

import {
  ArrowRight,
  Check,
  Crown,
  Globe,
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
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

type StakerPackage = {
  data_quantity: number;
  data_unit: string;
  has5g?: boolean;
  id: string;
  name: string;
  package_type?: string;
  package_validity: number;
  package_validity_unit: string;
};

/**
 * Test page: what the membership page looks like after someone has staked,
 * and how the flow leads to claiming an eSIM (pick country + plan → Claim → Activate).
 */
export function MembershipAfterStakeTestClient() {
  const [packages, setPackages] = useState<StakerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [packageType, setPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >("DATA-ONLY");
  const [countryId, setCountryId] = useState("");
  const [countries, setCountries] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/esim/countries")
      .then((r) => r.json())
      .then(
        (data: {
          data?: { id: number; name: string }[];
          status: boolean;
        }) => {
          if (data.status && Array.isArray(data.data)) {
            setCountries(
              data.data.slice().sort((a, b) => a.name.localeCompare(b.name)),
            );
          }
        },
      )
      .catch(() => setCountries([]))
      .finally(() => setCountriesLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("package_type", packageType);
    if (countryId) params.set("country", countryId);
    fetch(`/api/esim/packages/staker-claim?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { data?: StakerPackage[]; status: boolean }) => {
        if (data.status && Array.isArray(data.data)) {
          setPackages(data.data);
        } else {
          setPackages([]);
        }
      })
      .catch(() => setPackages([]))
      .finally(() => setLoading(false));
  }, [packageType, countryId]);

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

  return (
    <div
      className={`
        flex min-h-screen flex-col bg-gradient-to-b from-muted/50
        via-background to-background
      `}
    >
      {/* Test banner */}
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-800 dark:text-amber-200">
        <strong>Test preview:</strong> This is what the membership page looks
        like after you’ve staked. Scroll down to see the claim eSIM flow.{" "}
        <Link href="/membership" className="underline">
          Real membership
        </Link>
      </div>

      {/* Post-stake "hero" — what members see at the top */}
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
            <strong className="text-foreground">Tier 1</strong> — free eSIM,
            free shipping, and member discounts. Claim your free 30-day eSIM
            below.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Badge
              className="gap-1.5 px-3 py-1"
              variant="outline"
            >
              <Crown className="h-3.5 w-3.5" />
              Tier 1
            </Badge>
            <Badge className="gap-1.5 px-3 py-1" variant="outline">
              <Check className="h-3.5 w-3.5 text-green-600" />
              Free eSIM
            </Badge>
          </div>
          <div className="mt-8">
            <Button asChild variant="outline" size="sm">
              <Link href="/esim">
                <Globe className="mr-2 h-4 w-4" />
                Browse all eSIM plans
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Claim Free eSIM — same section as on real membership when eligible */}
      <section className="container mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Card
            className={`
              overflow-hidden border-2 border-primary/30 bg-gradient-to-br
              from-primary/5 via-background to-primary/5
            `}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="font-display text-2xl">
                {claimed ? "eSIM Claimed" : "Claim Your Free eSIM"}
              </CardTitle>
              <CardDescription className="text-base">
                {claimed
                  ? "Your free eSIM has been provisioned. Activate it in your dashboard or check your email for the link."
                  : "As a Tier 1 member, you can claim one 30-day eSIM card at no cost. Choose a plan below and click Claim to activate."}
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
                  <div className="flex w-full flex-wrap items-center justify-center gap-4">
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
                        onClick={() =>
                          setPackageType("DATA-VOICE-SMS")
                        }
                        size="sm"
                        variant={
                          packageType === "DATA-VOICE-SMS"
                            ? "default"
                            : "outline"
                        }
                      >
                        <Signal className="mr-1 h-4 w-4" />
                        Data + minutes
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
                        disabled={countriesLoading}
                        value={countryId}
                        onChange={(e) => setCountryId(e.target.value)}
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
                      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {packages.map((pkg) => (
                          <Card
                            key={pkg.id}
                            className="flex flex-col border border-border bg-card"
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
                                {claimingId === pkg.id ? "Claiming…" : "Claim"}
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
    </div>
  );
}
