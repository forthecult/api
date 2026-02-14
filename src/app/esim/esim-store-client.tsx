"use client";

import { Globe, Loader2, MapPin, Search, Signal, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import {
  formatEsimPackageName,
  formatValidityOption,
  getUnlimitedPlanBaseName,
  getUnlimitedPlanGroupKey,
} from "~/lib/esim-format";
import { useCart } from "~/lib/hooks/use-cart";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/ui/primitives/tabs";

// ---------- Types ----------

type Country = {
  id: number;
  name: string;
  image_url: string;
};

type Continent = {
  id: number;
  name: string;
  code: string;
  image_url: string;
};

type Package = {
  id: string;
  name: string;
  price: string;
  data_quantity: number;
  data_unit: string;
  voice_quantity?: number;
  voice_unit?: string;
  sms_quantity?: number;
  package_validity: number;
  package_validity_unit: string;
  package_type?: string;
  unlimited?: boolean;
  /** When true, show 5G badge (from coverage data; list API may not provide this). */
  has5g?: boolean;
};

type ValidityFilter = "all" | "7" | "14" | "30" | "30+";
type DataFilter =
  | "all"
  | "1"
  | "1-5"
  | "5-10"
  | "10-25"
  | "25+"
  | "unlimited";

function matchesValidity(pkg: Package, filter: ValidityFilter): boolean {
  if (filter === "all") return true;
  const days =
    (pkg.package_validity_unit ?? "day").toLowerCase().startsWith("day")
      ? pkg.package_validity
      : pkg.package_validity;
  if (filter === "7") return days === 7;
  if (filter === "14") return days === 14;
  if (filter === "30") return days === 30;
  if (filter === "30+") return days >= 30;
  return true;
}

function matchesData(pkg: Package, filter: DataFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unlimited") return Boolean(pkg.unlimited);
  const gb =
    (pkg.data_unit ?? "GB").toUpperCase() === "GB"
      ? pkg.data_quantity
      : pkg.data_quantity / 1024;
  if (filter === "1") return gb >= 0.5 && gb < 2;
  if (filter === "1-5") return gb >= 1 && gb < 5;
  if (filter === "5-10") return gb >= 5 && gb < 10;
  if (filter === "10-25") return gb >= 10 && gb < 25;
  if (filter === "25+") return gb >= 25;
  return true;
}

/** One card (single package) or a group of unlimited packages (same product line). */
type PlanItem =
  | { type: "single"; pkg: Package }
  | { type: "unlimited"; baseName: string; packages: Package[] };

function groupPackagesForDisplay(packages: Package[]): PlanItem[] {
  const unlimitedGroups = new Map<string, Package[]>();
  const singles: Package[] = [];

  for (const pkg of packages) {
    const isUnlimited = Boolean(pkg.unlimited || pkg.data_quantity === 0);
    const groupKey = isUnlimited ? getUnlimitedPlanGroupKey(pkg.name) : null;

    if (isUnlimited && groupKey) {
      const existing = unlimitedGroups.get(groupKey) ?? [];
      existing.push(pkg);
      unlimitedGroups.set(groupKey, existing);
    } else {
      singles.push(pkg);
    }
  }

  const result: PlanItem[] = [];
  for (const [groupKey, pkgs] of unlimitedGroups) {
    if (pkgs.length > 1) {
      pkgs.sort((a, b) => (a.package_validity ?? 0) - (b.package_validity ?? 0));
      const parts = groupKey.split("|");
      const base = parts[0]?.trim() || getUnlimitedPlanBaseName(pkgs[0]!.name) || "Unlimited";
      const variant = parts.length >= 3 ? parts[2]!.trim() : "";
      const baseName = variant && variant !== "default" ? `${base} (${variant})` : base;
      result.push({ type: "unlimited", baseName, packages: pkgs });
    } else {
      singles.push(pkgs[0]!);
    }
  }
  for (const pkg of singles) {
    result.push({ type: "single", pkg });
  }
  return result;
}

// ---------- Sub-components ----------

function PackageCard({
  pkg,
  onAddToCart,
  returnQuery,
}: {
  pkg: Package;
  onAddToCart?: (pkg: Package) => void;
  /** Query string to append so Back from detail returns to same filters (e.g. tab=countries&country=5). */
  returnQuery?: string;
}) {
  const detailHref = returnQuery ? `/esim/${pkg.id}?${returnQuery}` : `/esim/${pkg.id}`;
  return (
    <Card className="group relative h-full transition-all hover:shadow-md hover:border-primary/30 flex flex-col">
      {pkg.has5g && (
        <span
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm"
          title="5G available"
        >
          <Signal className="h-3 w-3" />
          5G
        </span>
      )}
      <Link href={detailHref} className="flex flex-col flex-1 min-h-0">
        <CardContent className="flex flex-col gap-3 p-5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors",
                pkg.has5g && "pr-12",
              )}
            >
              {formatEsimPackageName(pkg.name)}
            </h3>
            {pkg.package_type === "DATA-VOICE-SMS" && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                Voice+SMS
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5" />
              {pkg.unlimited || pkg.data_quantity === 0 ? "∞" : `${pkg.data_quantity} ${pkg.data_unit}`}
            </span>
            <span className="flex items-center gap-1">
              <Signal className="h-3.5 w-3.5" />
              {pkg.package_validity} {pkg.package_validity_unit}s
            </span>
          </div>
          {(pkg.package_type === "DATA-VOICE-SMS" || (pkg.voice_quantity ?? 0) > 0 || (pkg.sms_quantity ?? 0) > 0) && (
            <div className="text-xs text-muted-foreground">
              {(pkg.voice_quantity ?? 0) > 0 || (pkg.sms_quantity ?? 0) > 0 ? (
                <>
                  {(pkg.voice_quantity ?? 0) > 0 && <span>{pkg.voice_quantity} {pkg.voice_unit ?? "min"}</span>}
                  {(pkg.voice_quantity ?? 0) > 0 && (pkg.sms_quantity ?? 0) > 0 && <span> &middot; </span>}
                  {(pkg.sms_quantity ?? 0) > 0 && <span>{pkg.sms_quantity} SMS</span>}
                </>
              ) : (
                <span>Voice &amp; SMS included</span>
              )}
            </div>
          )}
          <div className="mt-auto pt-2 flex items-start justify-between gap-2 border-t">
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-primary">${pkg.price}</span>
              <CryptoPrice
                usdAmount={Number(pkg.price)}
                className="text-sm text-muted-foreground"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              ${(Number(pkg.price) / pkg.package_validity).toFixed(2)}/day
            </span>
          </div>
        </CardContent>
      </Link>
      {onAddToCart && (
        <div className="px-5 pb-5 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(pkg);
            }}
          >
            Add to Cart
          </Button>
        </div>
      )}
    </Card>
  );
}

function UnlimitedPlanCard({
  baseName,
  packages: groupPackages,
  onAddToCart,
  returnQuery,
}: {
  baseName: string;
  packages: Package[];
  onAddToCart?: (pkg: Package) => void;
  returnQuery?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = groupPackages[selectedIndex] ?? groupPackages[0]!;
  const has5g = groupPackages.some((p) => p.has5g);
  const detailHref = selected
    ? (returnQuery ? `/esim/${selected.id}?${returnQuery}` : `/esim/${selected.id}`)
    : "#";

  return (
    <Card className="group relative flex h-full flex-col transition-all hover:shadow-md hover:border-primary/30">
      {has5g && (
        <span
          className="absolute top-3 right-3 z-10 inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-sm"
          title="5G available"
        >
          <Signal className="h-3 w-3" />
          5G
        </span>
      )}
      <CardContent className="flex flex-col gap-3 p-5 flex-1">
        <h3
          className={cn(
            "text-sm font-semibold leading-tight text-primary",
            has5g && "pr-12",
          )}
        >
          ∞ {baseName}
        </h3>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary">
              ${selected.price}
            </span>
            <span className="text-xs text-muted-foreground">USD</span>
          </div>
          <CryptoPrice
            usdAmount={Number(selected.price)}
            className="text-sm text-muted-foreground"
          />
        </div>
        {(groupPackages[0]?.package_type === "DATA-VOICE-SMS" ||
          (groupPackages.some((p) => (p.voice_quantity ?? 0) > 0 || (p.sms_quantity ?? 0) > 0))) && (
          <div className="text-xs text-muted-foreground">
            {(() => {
              const p = groupPackages[0];
              if (!p) return null;
              const v = p.voice_quantity ?? 0;
              const s = p.sms_quantity ?? 0;
              if (v > 0 || s > 0)
                return (
                  <>
                    {v > 0 && <span>{v} {p.voice_unit ?? "min"}</span>}
                    {v > 0 && s > 0 && " · "}
                    {s > 0 && <span>{s} SMS</span>}
                  </>
                );
              return <span>Voice &amp; SMS included</span>;
            })()}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Days
          </label>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium"
            aria-label="Select duration"
          >
            {groupPackages.map((pkg, i) => (
              <option key={pkg.id} value={i}>
                {formatValidityOption(pkg.package_validity ?? 1)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2 text-sm text-muted-foreground">
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {(() => {
              const name = groupPackages[0]?.name ?? "";
              const inMatch = name.match(/\s+in\s+(.+)$/i);
              const region = inMatch
                ? inMatch[1]
                  .replace(/,?\s*(Throttled|Unthrottled|V2).*$/i, "")
                  .replace(/\s*,\s*$/, "")
                  .trim()
                : "";
              return region || "—";
            })()}
          </span>
        </div>
        <div className="flex items-center gap-2 border-t pt-3">
          <Link
            href={detailHref}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Details →
          </Link>
        </div>
      </CardContent>
      {onAddToCart && (
        <div className="px-5 pb-5 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(selected);
            }}
          >
            Add to Cart
          </Button>
        </div>
      )}
    </Card>
  );
}

function CountryCard({
  country,
  onClick,
}: {
  country: Country;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-all",
        "hover:shadow-md hover:border-primary/30 cursor-pointer w-full",
      )}
    >
      <Image
        src={country.image_url}
        alt={country.name}
        width={40}
        height={28}
        className="rounded-sm object-cover"
        unoptimized
      />
      <span className="text-sm font-medium">{country.name}</span>
    </button>
  );
}

function ContinentCard({
  continent,
  onClick,
}: {
  continent: Continent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border bg-card p-5 transition-all",
        "hover:shadow-md hover:border-primary/30 cursor-pointer",
      )}
    >
      <Globe className="h-8 w-8 text-primary" />
      <span className="text-sm font-semibold">{continent.name}</span>
    </button>
  );
}

function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

// ---------- Main Component ----------

const VALIDITY_OPTIONS: { value: ValidityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "30+", label: "30+ days" },
];

const DATA_OPTIONS: { value: DataFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "1", label: "1 GB" },
  { value: "1-5", label: "1-5 GB" },
  { value: "5-10", label: "5-10 GB" },
  { value: "10-25", label: "10-25 GB" },
  { value: "25+", label: "25+ GB" },
  { value: "unlimited", label: "Unlimited" },
];

function parseValidity(s: string | null): ValidityFilter {
  if (s === "7" || s === "14" || s === "30" || s === "30+") return s;
  return "all";
}

function parseData(s: string | null): DataFilter {
  if (
    s === "1" ||
    s === "1-5" ||
    s === "5-10" ||
    s === "10-25" ||
    s === "25+" ||
    s === "unlimited"
  )
    return s;
  return "all";
}

export function EsimStorePage() {
  const searchParams = useSearchParams();
  const { addItem, openCart } = useCart();
  const [activeTab, setActiveTab] = useState<"countries" | "continents" | "global">(
    () => (searchParams.get("tab") as "countries" | "continents" | "global") || "countries",
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [continentsLoading, setContinentsLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedContinent, setSelectedContinent] =
    useState<Continent | null>(null);
  const [packageType, setPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >(() => (searchParams.get("packageType") as "DATA-ONLY" | "DATA-VOICE-SMS") || "DATA-ONLY");
  const [filterValidity, setFilterValidity] = useState<ValidityFilter>(
    () => parseValidity(searchParams.get("validity")),
  );
  const [filterData, setFilterData] = useState<DataFilter>(() =>
    parseData(searchParams.get("data")),
  );
  const restoredFromUrlRef = useRef(false);

  // Fetch countries
  useEffect(() => {
    setCountriesLoading(true);
    fetch("/api/esim/countries")
      .then((res) => res.json())
      .then((data: { status: boolean; data?: Country[] }) => {
        if (data.status && data.data) {
          setCountries(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setCountriesLoading(false));
  }, []);

  // Fetch continents
  useEffect(() => {
    setContinentsLoading(true);
    fetch("/api/esim/continents")
      .then((res) => res.json())
      .then((data: { status: boolean; data?: Continent[] }) => {
        if (data.status && data.data) {
          setContinents(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setContinentsLoading(false));
  }, []);

  // Fetch global packages when tab is "global"
  useEffect(() => {
    if (activeTab !== "global") return;
    setLoading(true);
    fetch(`/api/esim/packages/global?package_type=${packageType}`)
      .then((res) => res.json())
      .then((data: { status: boolean; data?: Package[] }) => {
        if (data.status && data.data) {
          setPackages(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTab, packageType]);

  // Fetch country packages
  const handleCountrySelect = useCallback(
    (country: Country) => {
      setSelectedCountry(country);
      setSelectedContinent(null);
      setLoading(true);
      fetch(
        `/api/esim/packages/country/${country.id}?package_type=${packageType}`,
      )
        .then((res) => res.json())
        .then((data: { status: boolean; data?: Package[] }) => {
          if (data.status && data.data) {
            setPackages(data.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    },
    [packageType],
  );

  // Fetch continent packages
  const handleContinentSelect = useCallback(
    (continent: Continent) => {
      setSelectedContinent(continent);
      setSelectedCountry(null);
      setLoading(true);
      fetch(
        `/api/esim/packages/continent/${continent.id}?package_type=${packageType}`,
      )
        .then((res) => res.json())
        .then((data: { status: boolean; data?: Package[] }) => {
          if (data.status && data.data) {
            setPackages(data.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    },
    [packageType],
  );

  // Re-fetch when packageType changes
  useEffect(() => {
    if (selectedCountry) {
      handleCountrySelect(selectedCountry);
    } else if (selectedContinent) {
      handleContinentSelect(selectedContinent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageType]);

  // Restore country/continent selection from URL when returning from detail page
  useEffect(() => {
    if (restoredFromUrlRef.current) return;
    if (activeTab === "countries" && countries.length > 0) {
      const countryId = searchParams.get("country");
      if (countryId) {
        const c = countries.find((x) => x.id === Number(countryId));
        if (c) {
          restoredFromUrlRef.current = true;
          setSelectedCountry(c);
          setLoading(true);
          fetch(
            `/api/esim/packages/country/${c.id}?package_type=${packageType}`,
          )
            .then((res) => res.json())
            .then((data: { status: boolean; data?: Package[] }) => {
              if (data.status && data.data) setPackages(data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        }
      }
    }
    if (activeTab === "continents" && continents.length > 0) {
      const continentId = searchParams.get("continent");
      if (continentId) {
        const c = continents.find((x) => x.id === Number(continentId));
        if (c) {
          restoredFromUrlRef.current = true;
          setSelectedContinent(c);
          setLoading(true);
          fetch(
            `/api/esim/packages/continent/${c.id}?package_type=${packageType}`,
          )
            .then((res) => res.json())
            .then((data: { status: boolean; data?: Package[] }) => {
              if (data.status && data.data) setPackages(data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        }
      }
    }
    if (activeTab === "global" || (!searchParams.get("country") && !searchParams.get("continent"))) {
      restoredFromUrlRef.current = true;
    }
  }, [activeTab, countries, continents, packageType, searchParams]);

  // Build query string so detail page Back link returns to same tab/filters
  const returnQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set("tab", activeTab);
    p.set("validity", filterValidity);
    p.set("data", filterData);
    p.set("packageType", packageType);
    if (selectedCountry) p.set("country", String(selectedCountry.id));
    if (selectedContinent) p.set("continent", String(selectedContinent.id));
    return p.toString();
  }, [activeTab, filterValidity, filterData, packageType, selectedCountry, selectedContinent]);

  // Sync tab, filters, and selection to URL so Back from detail returns to same state
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    params.set("packageType", packageType);
    if (filterValidity === "all") params.delete("validity");
    else params.set("validity", filterValidity);
    if (filterData === "all") params.delete("data");
    else params.set("data", filterData);
    if (selectedCountry) params.set("country", String(selectedCountry.id));
    else params.delete("country");
    if (selectedContinent) params.set("continent", String(selectedContinent.id));
    else params.delete("continent");
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      window.history.replaceState(
        null,
        "",
        next ? `${window.location.pathname}?${next}` : window.location.pathname,
      );
    }
  }, [filterValidity, filterData, searchParams]);

  // Client-side filter packages by validity and data
  const filteredPackages = useMemo(
    () =>
      packages.filter(
        (pkg) => matchesValidity(pkg, filterValidity) && matchesData(pkg, filterData),
      ),
    [packages, filterValidity, filterData],
  );

  // Group unlimited plans (same base name, multiple durations) into one card with days dropdown
  const displayItems = useMemo(
    () => groupPackagesForDisplay(filteredPackages),
    [filteredPackages],
  );

  // Filter countries by search
  const filteredCountries = useMemo(
    () =>
      searchQuery.trim()
        ? countries.filter((c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : countries,
    [countries, searchQuery],
  );

  const clearSelection = () => {
    setSelectedCountry(null);
    setSelectedContinent(null);
    setPackages([]);
  };

  const handleAddToCart = useCallback(
    (pkg: Package) => {
      addItem({
        id: `esim_${pkg.id}`,
        name: `eSIM: ${pkg.name}`,
        price: parseFloat(pkg.price),
        category: "eSIM",
        image: "/placeholder.svg",
        digital: true,
        esimPackageId: pkg.id,
        esimPackageType: pkg.package_type ?? "DATA-ONLY",
      });
      toast.success("eSIM added to cart");
      openCart();
    },
    [addItem, openCart],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Wifi className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          eSIM Data Plans
        </h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          Get instant mobile data for 200+ countries. No physical SIM card
          needed — activate in seconds right from your phone.
        </p>
      </div>

      {/* Package type toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant={packageType === "DATA-ONLY" ? "default" : "outline"}
          size="sm"
          onClick={() => setPackageType("DATA-ONLY")}
        >
          <Wifi className="mr-1 h-4 w-4" />
          Data Only
        </Button>
        <Button
          variant={packageType === "DATA-VOICE-SMS" ? "default" : "outline"}
          size="sm"
          onClick={() => setPackageType("DATA-VOICE-SMS")}
        >
          <Signal className="mr-1 h-4 w-4" />
          Data + Voice + SMS
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "countries" | "continents" | "global"); clearSelection(); }}>
        <TabsList className="mx-auto mb-6">
          <TabsTrigger value="countries">
            <MapPin className="mr-1 h-4 w-4" />
            By Country
          </TabsTrigger>
          <TabsTrigger value="continents">
            <Globe className="mr-1 h-4 w-4" />
            By Region
          </TabsTrigger>
          <TabsTrigger value="global">
            <Wifi className="mr-1 h-4 w-4" />
            Global
          </TabsTrigger>
        </TabsList>

        {/* Countries Tab */}
        <TabsContent value="countries">
          {!selectedCountry ? (
            <>
              <div className="relative mb-6 max-w-md mx-auto">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {countriesLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading countries…</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {filteredCountries.map((country) => (
                      <CountryCard
                        key={country.id}
                        country={country}
                        onClick={() => handleCountrySelect(country)}
                      />
                    ))}
                  </div>
                  {filteredCountries.length === 0 && (
                    <p className="py-16 text-center text-muted-foreground">
                      {searchQuery.trim()
                        ? `No countries found matching "${searchQuery}"`
                        : "No countries available."}
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  &larr; All Countries
                </Button>
                <div className="flex items-center gap-2">
                  <Image
                    src={selectedCountry.image_url}
                    alt={selectedCountry.name}
                    width={32}
                    height={22}
                    className="rounded-sm"
                    unoptimized
                  />
                  <h2 className="text-lg font-semibold">
                    {selectedCountry.name}
                  </h2>
                </div>
              </div>
              {loading ? (
                <LoadingSpinner text="Loading packages..." />
              ) : packages.length > 0 ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">Filter:</span>
                    <select
                      value={filterValidity}
                      onChange={(e) =>
                        setFilterValidity(e.target.value as ValidityFilter)
                      }
                      className={cn(
                        "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                      )}
                      aria-label="Filter by validity"
                    >
                      {VALIDITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterData}
                      onChange={(e) =>
                        setFilterData(e.target.value as DataFilter)
                      }
                      className={cn(
                        "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                      )}
                      aria-label="Filter by data"
                    >
                      {DATA_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayItems.map((item) =>
                      item.type === "single" ? (
                        <PackageCard
                          key={item.pkg.id}
                          pkg={item.pkg}
                          onAddToCart={handleAddToCart}
                          returnQuery={returnQuery}
                        />
                      ) : (
                        <UnlimitedPlanCard
                          key={`unlimited-${item.baseName}`}
                          baseName={item.baseName}
                          packages={item.packages}
                          onAddToCart={handleAddToCart}
                          returnQuery={returnQuery}
                        />
                      ),
                    )}
                  </div>
                  {displayItems.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">
                      No packages match the selected filters.
                    </p>
                  )}
                </>
              ) : (
                <p className="py-16 text-center text-muted-foreground">
                  No {packageType === "DATA-VOICE-SMS" ? "Data+Voice+SMS" : "data"} packages available for{" "}
                  {selectedCountry.name}.
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* Continents Tab */}
        <TabsContent value="continents">
          {!selectedContinent ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {continents.map((continent) => (
                <ContinentCard
                  key={continent.id}
                  continent={continent}
                  onClick={() => handleContinentSelect(continent)}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  &larr; All Regions
                </Button>
                <h2 className="text-lg font-semibold">
                  {selectedContinent.name}
                </h2>
              </div>
              {loading ? (
                <LoadingSpinner text="Loading packages..." />
              ) : packages.length > 0 ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">Filter:</span>
                    <select
                      value={filterValidity}
                      onChange={(e) =>
                        setFilterValidity(e.target.value as ValidityFilter)
                      }
                      className={cn(
                        "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                      )}
                      aria-label="Filter by validity"
                    >
                      {VALIDITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterData}
                      onChange={(e) =>
                        setFilterData(e.target.value as DataFilter)
                      }
                      className={cn(
                        "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                      )}
                      aria-label="Filter by data"
                    >
                      {DATA_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {displayItems.map((item) =>
                      item.type === "single" ? (
                        <PackageCard
                          key={item.pkg.id}
                          pkg={item.pkg}
                          onAddToCart={handleAddToCart}
                          returnQuery={returnQuery}
                        />
                      ) : (
                        <UnlimitedPlanCard
                          key={`unlimited-${item.baseName}`}
                          baseName={item.baseName}
                          packages={item.packages}
                          onAddToCart={handleAddToCart}
                          returnQuery={returnQuery}
                        />
                      ),
                    )}
                  </div>
                  {displayItems.length === 0 && (
                    <p className="py-8 text-center text-muted-foreground">
                      No packages match the selected filters.
                    </p>
                  )}
                </>
              ) : (
                <p className="py-16 text-center text-muted-foreground">
                  No packages available for {selectedContinent.name}.
                </p>
              )}
            </>
          )}
        </TabsContent>

        {/* Global Tab */}
        <TabsContent value="global">
          {loading ? (
            <LoadingSpinner text="Loading global packages..." />
          ) : packages.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">Filter:</span>
                <select
                  value={filterValidity}
                  onChange={(e) =>
                    setFilterValidity(e.target.value as ValidityFilter)
                  }
                  className={cn(
                    "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                  )}
                  aria-label="Filter by validity"
                >
                  {VALIDITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterData}
                  onChange={(e) =>
                    setFilterData(e.target.value as DataFilter)
                  }
                  className={cn(
                    "w-[130px] rounded-md border border-input bg-background px-3 py-2 text-sm",
                  )}
                  aria-label="Filter by data"
                >
                  {DATA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayItems.map((item) =>
                  item.type === "single" ? (
                    <PackageCard
                      key={item.pkg.id}
                      pkg={item.pkg}
                      onAddToCart={handleAddToCart}
                      returnQuery={returnQuery}
                    />
                  ) : (
                    <UnlimitedPlanCard
                      key={`unlimited-${item.baseName}`}
                      baseName={item.baseName}
                      packages={item.packages}
                      onAddToCart={handleAddToCart}
                      returnQuery={returnQuery}
                    />
                  ),
                )}
              </div>
              {displayItems.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No packages match the selected filters.
                </p>
              )}
            </>
          ) : (
            <p className="py-16 text-center text-muted-foreground">
              No global packages available.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Info section */}
      <section className="mt-16 border-t border-border pt-12">
        <h2 className="text-center mb-10 text-3xl font-bold text-[#1A1611] dark:text-[#F5F1EB]">
          How eSIM Works
        </h2>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl font-bold text-primary">1</span>
            </div>
            <h3 className="text-xl font-semibold text-[#1A1611] dark:text-[#F5F1EB]">Choose a Plan</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Select a country or region and pick a data plan that fits your
              needs.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl font-bold text-primary">2</span>
            </div>
            <h3 className="text-xl font-semibold text-[#1A1611] dark:text-[#F5F1EB]">Purchase &amp; Install</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Complete your purchase and scan the QR code or tap the activation
              link on your device.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl font-bold text-primary">3</span>
            </div>
            <h3 className="text-xl font-semibold text-[#1A1611] dark:text-[#F5F1EB]">Stay Connected</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Your eSIM activates instantly. Enjoy high-speed data wherever you
              go.
            </p>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
