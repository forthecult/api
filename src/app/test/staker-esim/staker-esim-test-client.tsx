"use client";

import { ArrowRight, Globe, Signal, Smartphone, Wifi } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { formatEsimPackageName } from "~/lib/esim-format";
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
 * Dummy test page: shows what the eSIM claim experience looks like after a member has staked.
 * Pick by country and plan type (data only / data + minutes). Displays 30-day eSIM cards (no price). Claim → Activate.
 */
export function StakerEsimTestClient() {
  const [packages, setPackages] = useState<StakerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimed, setClaimed] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [packageType, setPackageType] = useState<"DATA-ONLY" | "DATA-VOICE-SMS">("DATA-ONLY");
  const [countryId, setCountryId] = useState("");
  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/esim/countries")
      .then((r) => r.json())
      .then((data: { data?: { id: number; name: string }[]; status: boolean }) => {
        if (data.status && Array.isArray(data.data)) {
          setCountries(data.data.slice().sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
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
      toast.success("Test: Claim recorded. In production you’d activate this eSIM in your dashboard.");
    }, 600);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-800 dark:text-amber-200">
          This is a <strong>test preview</strong> of the staker eSIM claim
          experience. No wallet or staking required.{" "}
          <Link href="/membership" className="underline">
            Stake on Membership
          </Link>{" "}
          to claim for real.
        </div>

        <Card className="overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5">
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
                : "As a staking member you can claim one 30-day eSIM card at no cost. Choose a plan below and click Claim to activate."}
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
                    <span className="text-sm text-muted-foreground">Plan:</span>
                    <Button
                      onClick={() => setPackageType("DATA-ONLY")}
                      size="sm"
                      variant={packageType === "DATA-ONLY" ? "default" : "outline"}
                    >
                      <Wifi className="mr-1 h-4 w-4" />
                      Data only
                    </Button>
                    <Button
                      onClick={() => setPackageType("DATA-VOICE-SMS")}
                      size="sm"
                      variant={packageType === "DATA-VOICE-SMS" ? "default" : "outline"}
                    >
                      <Signal className="mr-1 h-4 w-4" />
                      Data + minutes
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Country:</span>
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
                  <p className="text-muted-foreground">Loading eSIM plans…</p>
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
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    No 30-day plans under $25 for this selection. Try another
                    country or plan type, or visit the eSIM store.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
