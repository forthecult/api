"use client";

import { Globe, Loader2, MapPin, Minus, Plus, Search, Signal, Wifi } from "lucide-react";
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
  getVariantFromName,
} from "~/lib/esim-format";
import { useCart } from "~/lib/hooks/use-cart";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { CryptoPrice } from "~/ui/components/CryptoPrice";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/ui/primitives/tabs";

import { EsimDeviceCompatibilityModal } from "~/app/esim/esim-device-compatibility-modal";

// ---------- Types ----------

interface Continent {
  code: string;
  id: number;
  image_url: string;
  name: string;
}

interface Country {
  id: number;
  image_url: string;
  name: string;
}

type DataFilter = "1" | "1-5" | "5-10" | "10-25" | "25+" | "all" | "unlimited";

interface Package {
  data_quantity: number;
  data_unit: string;
  /** When true, show 5G badge (from coverage data; list API may not provide this). */
  has5g?: boolean;
  id: string;
  name: string;
  package_type?: string;
  package_validity: number;
  package_validity_unit: string;
  price: string;
  sms_quantity?: number;
  unlimited?: boolean;
  voice_quantity?: number;
  voice_unit?: string;
}
/** One card (single package) or a group of unlimited packages (same product line). */
type PlanItem =
  | { baseName: string; packages: Package[]; type: "unlimited" }
  | { pkg: Package; type: "single" };

type ValidityFilter = "7" | "14" | "30" | "30+" | "all";

function ContinentCard({
  continent,
  onClick,
}: {
  continent: Continent;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        `
          flex flex-col items-center gap-2 rounded-lg border bg-card p-5
          transition-all
        `,
        `
          cursor-pointer
 hover:border-primary/30 
        `,
      )}
      onClick={onClick}
      type="button"
    >
      <Globe className="h-8 w-8 text-primary" />
      <span className="text-sm font-semibold">{continent.name}</span>
    </button>
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
      className={cn(
        `
          flex items-center gap-3 rounded-lg border bg-card p-3 text-left
          transition-all
        `,
        `
          w-full cursor-pointer
 hover:border-primary/30 
        `,
      )}
      onClick={onClick}
      type="button"
    >
      <Image
        alt={country.name}
        className="rounded-sm object-cover"
        height={28}
        src={country.image_url}
        unoptimized
        width={40}
      />
      <span className="text-sm font-medium">{country.name}</span>
    </button>
  );
}

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
      pkgs.sort(
        (a, b) => (a.package_validity ?? 0) - (b.package_validity ?? 0),
      );
      const parts = groupKey.split("|");
      const base =
        parts[0]?.trim() ||
        getUnlimitedPlanBaseName(pkgs[0]!.name) ||
        "Unlimited";
      const variant = parts.length >= 3 ? parts[2]!.trim() : "";
      const baseName =
        variant && variant !== "default" ? `${base} (${variant})` : base;
      result.push({ baseName, packages: pkgs, type: "unlimited" });
    } else {
      singles.push(pkgs[0]!);
    }
  }
  for (const pkg of singles) {
    result.push({ pkg, type: "single" });
  }
  return result;
}

// ---------- Sub-components ----------

function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
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

function matchesValidity(pkg: Package, filter: ValidityFilter): boolean {
  if (filter === "all") return true;
  const days = (pkg.package_validity_unit ?? "day")
    .toLowerCase()
    .startsWith("day")
    ? pkg.package_validity
    : pkg.package_validity;
  if (filter === "7") return days === 7;
  if (filter === "14") return days === 14;
  if (filter === "30") return days === 30;
  if (filter === "30+") return days >= 30;
  return true;
}

function PackageCard({
  onAddToCart,
  pkg,
  returnQuery,
}: {
  onAddToCart?: (pkg: Package) => void;
  pkg: Package;
  /** Query string to append so Back from detail returns to same filters (e.g. tab=countries&country=5). */
  returnQuery?: string;
}) {
  const { currency } = useCountryCurrency();
  const detailHref = returnQuery
    ? `/esim/${pkg.id}?${returnQuery}`
    : `/esim/${pkg.id}`;
  return (
    <Card
      className={`
      group relative flex h-full flex-col transition-all
 hover:border-primary/30 
    `}
    >
      {pkg.has5g && (
        <span
          className={`
            absolute top-3 right-3 z-10 inline-flex items-center gap-0.5 rounded
            bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary
 
          `}
          title="5G available"
        >
          <Signal className="h-3 w-3" />
          5G
        </span>
      )}
      <Link className="flex min-h-0 flex-1 flex-col" href={detailHref}>
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                `
                  line-clamp-2 text-sm leading-tight font-semibold
                  transition-colors
                  group-hover:text-primary
                `,
                pkg.has5g && "pr-12",
              )}
            >
              {formatEsimPackageName(pkg.name)}
            </h3>
            {pkg.package_type === "DATA-VOICE-SMS" && (
              <Badge className="shrink-0 text-[10px]" variant="secondary">
                Voice+SMS
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5" />
              {pkg.unlimited || pkg.data_quantity === 0
                ? "∞"
                : `${pkg.data_quantity} ${pkg.data_unit}`}
            </span>
            <span className="flex items-center gap-1">
              <Signal className="h-3.5 w-3.5" />
              {pkg.package_validity} {pkg.package_validity_unit}s
            </span>
          </div>
          {(pkg.package_type === "DATA-VOICE-SMS" ||
            (pkg.voice_quantity ?? 0) > 0 ||
            (pkg.sms_quantity ?? 0) > 0) && (
            <div className="text-xs text-muted-foreground">
              {(pkg.voice_quantity ?? 0) > 0 || (pkg.sms_quantity ?? 0) > 0 ? (
                <>
                  {(pkg.voice_quantity ?? 0) > 0 && (
                    <span>
                      {pkg.voice_quantity} {pkg.voice_unit ?? "min"}
                    </span>
                  )}
                  {(pkg.voice_quantity ?? 0) > 0 &&
                    (pkg.sms_quantity ?? 0) > 0 && <span> &middot; </span>}
                  {(pkg.sms_quantity ?? 0) > 0 && (
                    <span>{pkg.sms_quantity} SMS</span>
                  )}
                </>
              ) : (
                <span>Voice &amp; SMS included</span>
              )}
            </div>
          )}
          <div
            className={`
            mt-auto flex items-start justify-between gap-2 border-t pt-2
          `}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-primary">
                ${pkg.price}
              </span>
              {currency !== "USD" && (
                <span className="text-sm text-muted-foreground">
                  ≈ <FiatPrice usdAmount={Number(pkg.price)} />
                </span>
              )}
              <CryptoPrice
                className="text-sm text-muted-foreground"
                usdAmount={Number(pkg.price)}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              ${(Number(pkg.price) / pkg.package_validity).toFixed(2)}/day
            </span>
          </div>
        </CardContent>
      </Link>
      {onAddToCart && (
        <div className="px-5 pt-0 pb-5">
          <Button
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(pkg);
            }}
            size="sm"
            variant="outline"
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
  onAddToCart,
  packages: groupPackages,
  returnQuery,
}: {
  baseName: string;
  onAddToCart?: (pkg: Package) => void;
  packages: Package[];
  returnQuery?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = groupPackages[selectedIndex] ?? groupPackages[0]!;
  const has5g = groupPackages.some((p) => p.has5g);
  const { currency } = useCountryCurrency();
  const detailHref = selected
    ? returnQuery
      ? `/esim/${selected.id}?${returnQuery}`
      : `/esim/${selected.id}`
    : "#";

  return (
    <Card
      className={`
      group relative flex h-full flex-col transition-all
 hover:border-primary/30 
    `}
    >
      {has5g && (
        <span
          className={`
            absolute top-3 right-3 z-10 inline-flex items-center gap-0.5 rounded
            bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary
 
          `}
          title="5G available"
        >
          <Signal className="h-3 w-3" />
          5G
        </span>
      )}
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <h3
          className={cn(
            "text-sm leading-tight font-semibold text-primary",
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
          {currency !== "USD" && (
            <span className="text-sm text-muted-foreground">
              ≈ <FiatPrice usdAmount={Number(selected.price)} />
            </span>
          )}
          <CryptoPrice
            className="text-sm text-muted-foreground"
            usdAmount={Number(selected.price)}
          />
        </div>
        {(groupPackages[0]?.package_type === "DATA-VOICE-SMS" ||
          groupPackages.some(
            (p) => (p.voice_quantity ?? 0) > 0 || (p.sms_quantity ?? 0) > 0,
          )) && (
          <div className="text-xs text-muted-foreground">
            {(() => {
              const p = groupPackages[0];
              if (!p) return null;
              const v = p.voice_quantity ?? 0;
              const s = p.sms_quantity ?? 0;
              if (v > 0 || s > 0)
                return (
                  <>
                    {v > 0 && (
                      <span>
                        {v} {p.voice_unit ?? "min"}
                      </span>
                    )}
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
            aria-label="Select duration"
            className={`
              w-full rounded-md border border-input bg-background px-3 py-2
              text-sm font-medium
            `}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            value={selectedIndex}
          >
            {groupPackages.map((pkg, i) => {
              const days = formatValidityOption(pkg.package_validity ?? 1);
              const variant = getVariantFromName(pkg.name);
              const label =
                variant && variant !== "default"
                  ? `${days} (${variant})`
                  : days;
              return (
                <option key={pkg.id} value={i}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div
          className={`
          mt-auto flex items-center gap-2 pt-2 text-sm text-muted-foreground
        `}
        >
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
            className={`
              text-sm font-medium text-primary
              hover:underline
            `}
            href={detailHref}
          >
            View Details →
          </Link>
        </div>
      </CardContent>
      {onAddToCart && (
        <div className="px-5 pt-0 pb-5">
          <Button
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(selected);
            }}
            size="sm"
            variant="outline"
          >
            Add to Cart
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------- Main Component ----------

const VALIDITY_OPTIONS: { label: string; value: ValidityFilter }[] = [
  { label: "All", value: "all" },
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "30+ days", value: "30+" },
];

const DATA_OPTIONS: { label: string; value: DataFilter }[] = [
  { label: "All", value: "all" },
  { label: "1 GB", value: "1" },
  { label: "1-5 GB", value: "1-5" },
  { label: "5-10 GB", value: "5-10" },
  { label: "10-25 GB", value: "10-25" },
  { label: "25+ GB", value: "25+" },
  { label: "Unlimited", value: "unlimited" },
];

/** Ordered list of name aliases for "most popular" countries (US, UK, Germany, …). */
const MOST_POPULAR_COUNTRY_ALIASES: string[][] = [
  ["United States", "USA", "US"],
  ["United Kingdom", "UK", "Great Britain"],
  ["Germany"],
  ["Japan"],
  ["United Arab Emirates", "UAE"],
  ["Philippines"],
  ["Hong Kong"],
  ["Canada"],
  ["Brazil"],
  ["Indonesia"],
];

const MOST_POPULAR_EXCLUDE = new Set(["united states virgin islands"]);

function getPopularIndex(country: Country): number {
  const name = country.name.toLowerCase();
  if (MOST_POPULAR_EXCLUDE.has(name)) return -1;
  for (let i = 0; i < MOST_POPULAR_COUNTRY_ALIASES.length; i++) {
    const matched = MOST_POPULAR_COUNTRY_ALIASES[i]!.some(
      (alias) =>
        name === alias.toLowerCase() ||
        name.startsWith(alias.toLowerCase() + " ") ||
        name.startsWith(alias.toLowerCase() + ","),
    );
    if (matched) return i;
  }
  return -1;
}

export function EsimStorePage() {
  const searchParams = useSearchParams();
  const { addItem, openCart } = useCart();
  const [activeTab, setActiveTab] = useState<
    "continents" | "countries" | "global"
  >(
    () =>
      (searchParams.get("tab") as "continents" | "countries" | "global") ||
      "countries",
  );
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [continentsLoading, setContinentsLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedContinent, setSelectedContinent] = useState<Continent | null>(
    null,
  );
  const [packageType, setPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >(
    () =>
      (searchParams.get("packageType") as "DATA-ONLY" | "DATA-VOICE-SMS") ||
      "DATA-ONLY",
  );
  const [filterValidity, setFilterValidity] = useState<ValidityFilter>(() =>
    parseValidity(searchParams.get("validity")),
  );
  const [filterData, setFilterData] = useState<DataFilter>(() =>
    parseData(searchParams.get("data")),
  );
  const [deviceCompatibilityOpen, setDeviceCompatibilityOpen] = useState(false);
  const [faqOpenIds, setFaqOpenIds] = useState<Set<string>>(new Set());
  const restoredFromUrlRef = useRef(false);

  const toggleFaq = (id: string) => {
    setFaqOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Fetch countries
  useEffect(() => {
    setCountriesLoading(true);
    fetch("/api/esim/countries")
      .then((res) => res.json())
      .then((raw: unknown) => { const data = raw as { data?: Country[]; status: boolean };
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
      .then((raw: unknown) => { const data = raw as { data?: Continent[]; status: boolean };
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
      .then((raw: unknown) => { const data = raw as { data?: Package[]; status: boolean };
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
        .then((raw: unknown) => { const data = raw as { data?: Package[]; status: boolean };
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
        .then((raw: unknown) => { const data = raw as { data?: Package[]; status: boolean };
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
            .then((raw: unknown) => { const data = raw as { data?: Package[]; status: boolean };
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
            .then((raw: unknown) => { const data = raw as { data?: Package[]; status: boolean };
              if (data.status && data.data) setPackages(data.data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        }
      }
    }
    if (
      activeTab === "global" ||
      (!searchParams.get("country") && !searchParams.get("continent"))
    ) {
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
  }, [
    activeTab,
    filterValidity,
    filterData,
    packageType,
    selectedCountry,
    selectedContinent,
  ]);

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
    if (selectedContinent)
      params.set("continent", String(selectedContinent.id));
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
        (pkg) =>
          matchesValidity(pkg, filterValidity) && matchesData(pkg, filterData),
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

  const popularCountries = useMemo(
    () =>
      filteredCountries
        .filter((c) => getPopularIndex(c) >= 0)
        .sort((a, b) => getPopularIndex(a) - getPopularIndex(b)),
    [filteredCountries],
  );

  const otherCountries = useMemo(
    () =>
      filteredCountries
        .filter((c) => getPopularIndex(c) < 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filteredCountries],
  );

  const showLoadAll =
    !searchQuery.trim() && otherCountries.length > 0 && !showAllCountries;
  const countriesToShowInFullList = showAllCountries || searchQuery.trim()
    ? otherCountries
    : [];

  const clearSelection = () => {
    setSelectedCountry(null);
    setSelectedContinent(null);
    setPackages([]);
  };

  const handleAddToCart = useCallback(
    (pkg: Package) => {
      addItem({
        category: "eSIM",
        digital: true,
        esimPackageId: pkg.id,
        esimPackageType: pkg.package_type ?? "DATA-ONLY",
        id: `esim_${pkg.id}`,
        image: "/placeholder.svg",
        name: `eSIM: ${pkg.name}`,
        price: parseFloat(pkg.price),
      });
      toast.success("eSIM added to cart");
      openCart();
    },
    [addItem, openCart],
  );

  return (
    <div className="min-h-screen bg-background">
      <div
        className={`
        container mx-auto max-w-7xl px-4 py-8
        sm:px-6
        lg:px-8
      `}
      >
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Wifi className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1
            className={`
            text-3xl font-bold tracking-tight
            sm:text-4xl
          `}
          >
            eSIM Data Plans
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
            Get instant mobile data for 200+ countries. No physical SIM card
            needed — activate in seconds right from your phone.
          </p>
        </div>

        {/* Package type toggle */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => setPackageType("DATA-ONLY")}
            size="sm"
            variant={packageType === "DATA-ONLY" ? "default" : "outline"}
          >
            <Wifi className="mr-1 h-4 w-4" />
            Data Only
          </Button>
          <Button
            onClick={() => setPackageType("DATA-VOICE-SMS")}
            size="sm"
            variant={packageType === "DATA-VOICE-SMS" ? "default" : "outline"}
          >
            <Signal className="mr-1 h-4 w-4" />
            Data + Voice + SMS
          </Button>
        </div>

        {/* Tabs */}
        <Tabs
          onValueChange={(v) => {
            setActiveTab(v as "continents" | "countries" | "global");
            clearSelection();
          }}
          value={activeTab}
        >
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
                <div className="relative mx-auto mb-6 max-w-md">
                  <Search
                    className={`
                    absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                    text-muted-foreground
                  `}
                  />
                  <Input
                    className="pl-9"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    value={searchQuery}
                  />
                </div>
                {countriesLoading ? (
                  <div
                    className={`
                    flex items-center justify-center gap-2 py-16
                    text-muted-foreground
                  `}
                  >
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading countries…</span>
                  </div>
                ) : (
                  <>
                    {popularCountries.length > 0 && (
                      <section className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold">
                          Most popular countries
                        </h2>
                        <div
                          className={`
                          grid grid-cols-2 gap-3
                          sm:grid-cols-3
                          md:grid-cols-4
                          lg:grid-cols-5
                        `}
                        >
                          {popularCountries.map((country) => (
                            <CountryCard
                              country={country}
                              key={country.id}
                              onClick={() => handleCountrySelect(country)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                    {showLoadAll && (
                      <div className="mb-8 flex justify-center">
                        <Button
                          onClick={() => setShowAllCountries(true)}
                          variant="outline"
                        >
                          Load all countries
                        </Button>
                      </div>
                    )}
                    {countriesToShowInFullList.length > 0 && (
                      <section>
                        <h2 className="mb-4 text-lg font-semibold">
                          All countries
                        </h2>
                        <div
                          className={`
                          grid grid-cols-2 gap-3
                          sm:grid-cols-3
                          md:grid-cols-4
                          lg:grid-cols-5
                        `}
                        >
                          {countriesToShowInFullList.map((country) => (
                            <CountryCard
                              country={country}
                              key={country.id}
                              onClick={() => handleCountrySelect(country)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
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
                  <Button onClick={clearSelection} size="sm" variant="outline">
                    &larr; All Countries
                  </Button>
                  <div className="flex items-center gap-2">
                    <Image
                      alt={selectedCountry.name}
                      className="rounded-sm"
                      height={22}
                      src={selectedCountry.image_url}
                      unoptimized
                      width={32}
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
                      <span className="text-sm text-muted-foreground">
                        Filter:
                      </span>
                      <select
                        aria-label="Filter by validity"
                        className={cn(
                          `
                            w-[130px] rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                          `,
                        )}
                        onChange={(e) =>
                          setFilterValidity(e.target.value as ValidityFilter)
                        }
                        value={filterValidity}
                      >
                        {VALIDITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by data"
                        className={cn(
                          `
                            w-[130px] rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                          `,
                        )}
                        onChange={(e) =>
                          setFilterData(e.target.value as DataFilter)
                        }
                        value={filterData}
                      >
                        {DATA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      className={`
                      grid gap-4
                      sm:grid-cols-2
                      lg:grid-cols-3
                      xl:grid-cols-4
                    `}
                    >
                      {displayItems.map((item) =>
                        item.type === "single" ? (
                          <PackageCard
                            key={item.pkg.id}
                            onAddToCart={handleAddToCart}
                            pkg={item.pkg}
                            returnQuery={returnQuery}
                          />
                        ) : (
                          <UnlimitedPlanCard
                            baseName={item.baseName}
                            key={`unlimited-${item.baseName}`}
                            onAddToCart={handleAddToCart}
                            packages={item.packages}
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
                    No{" "}
                    {packageType === "DATA-VOICE-SMS"
                      ? "Data+Voice+SMS"
                      : "data"}{" "}
                    packages available for {selectedCountry.name}.
                  </p>
                )}
              </>
            )}
          </TabsContent>

          {/* Continents Tab */}
          <TabsContent value="continents">
            {!selectedContinent ? (
              <div
                className={`
                grid grid-cols-2 gap-4
                sm:grid-cols-3
                md:grid-cols-4
                lg:grid-cols-6
              `}
              >
                {continents.map((continent) => (
                  <ContinentCard
                    continent={continent}
                    key={continent.id}
                    onClick={() => handleContinentSelect(continent)}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-3">
                  <Button onClick={clearSelection} size="sm" variant="outline">
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
                      <span className="text-sm text-muted-foreground">
                        Filter:
                      </span>
                      <select
                        aria-label="Filter by validity"
                        className={cn(
                          `
                            w-[130px] rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                          `,
                        )}
                        onChange={(e) =>
                          setFilterValidity(e.target.value as ValidityFilter)
                        }
                        value={filterValidity}
                      >
                        {VALIDITY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by data"
                        className={cn(
                          `
                            w-[130px] rounded-md border border-input
                            bg-background px-3 py-2 text-sm
                          `,
                        )}
                        onChange={(e) =>
                          setFilterData(e.target.value as DataFilter)
                        }
                        value={filterData}
                      >
                        {DATA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      className={`
                      grid gap-4
                      sm:grid-cols-2
                      lg:grid-cols-3
                      xl:grid-cols-4
                    `}
                    >
                      {displayItems.map((item) =>
                        item.type === "single" ? (
                          <PackageCard
                            key={item.pkg.id}
                            onAddToCart={handleAddToCart}
                            pkg={item.pkg}
                            returnQuery={returnQuery}
                          />
                        ) : (
                          <UnlimitedPlanCard
                            baseName={item.baseName}
                            key={`unlimited-${item.baseName}`}
                            onAddToCart={handleAddToCart}
                            packages={item.packages}
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
                    aria-label="Filter by validity"
                    className={cn(
                      `
                        w-[130px] rounded-md border border-input bg-background
                        px-3 py-2 text-sm
                      `,
                    )}
                    onChange={(e) =>
                      setFilterValidity(e.target.value as ValidityFilter)
                    }
                    value={filterValidity}
                  >
                    {VALIDITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by data"
                    className={cn(
                      `
                        w-[130px] rounded-md border border-input bg-background
                        px-3 py-2 text-sm
                      `,
                    )}
                    onChange={(e) =>
                      setFilterData(e.target.value as DataFilter)
                    }
                    value={filterData}
                  >
                    {DATA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className={`
                  grid gap-4
                  sm:grid-cols-2
                  lg:grid-cols-3
                  xl:grid-cols-4
                `}
                >
                  {displayItems.map((item) =>
                    item.type === "single" ? (
                      <PackageCard
                        key={item.pkg.id}
                        onAddToCart={handleAddToCart}
                        pkg={item.pkg}
                        returnQuery={returnQuery}
                      />
                    ) : (
                      <UnlimitedPlanCard
                        baseName={item.baseName}
                        key={`unlimited-${item.baseName}`}
                        onAddToCart={handleAddToCart}
                        packages={item.packages}
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
          <h2
            className={`
            mb-10 text-center text-3xl font-bold text-[#1A1611]
            dark:text-[#F5F1EB]
          `}
          >
            How eSIM Works
          </h2>
          <div
            className={`
            mx-auto grid w-full max-w-7xl grid-cols-1 gap-8
            sm:grid-cols-3
          `}
          >
            <div className="text-center">
              <div
                className={`
                mx-auto mb-4 flex h-14 w-14 items-center justify-center
                rounded-full bg-primary/10
              `}
              >
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h3
                className={`
                text-xl font-semibold text-[#1A1611]
                dark:text-[#F5F1EB]
              `}
              >
                Choose a Plan
              </h3>
              <p className="mt-2 text-base text-muted-foreground">
                Select a country or region and pick a data plan that fits your
                needs.
              </p>
            </div>
            <div className="text-center">
              <div
                className={`
                mx-auto mb-4 flex h-14 w-14 items-center justify-center
                rounded-full bg-primary/10
              `}
              >
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h3
                className={`
                text-xl font-semibold text-[#1A1611]
                dark:text-[#F5F1EB]
              `}
              >
                Purchase &amp; Install
              </h3>
              <p className="mt-2 text-base text-muted-foreground">
                Complete your purchase and scan the QR code or tap the
                activation link on your device.
              </p>
            </div>
            <div className="text-center">
              <div
                className={`
                mx-auto mb-4 flex h-14 w-14 items-center justify-center
                rounded-full bg-primary/10
              `}
              >
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h3
                className={`
                text-xl font-semibold text-[#1A1611]
                dark:text-[#F5F1EB]
              `}
              >
                Stay Connected
              </h3>
              <p className="mt-2 text-base text-muted-foreground">
                Your eSIM activates instantly. Enjoy high-speed data wherever
                you go.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16 border-t border-border pt-12">
          <h2
            className={`
            mb-10 text-center text-3xl font-bold text-[#1A1611]
            dark:text-[#F5F1EB]
          `}
          >
            Frequently asked questions
          </h2>
          <div className="mx-auto w-full max-w-7xl space-y-3">
            {[
              {
                id: "devices",
                q: "What devices support eSIM?",
                a: (
                  <>
                    eSIMs are compatible with many devices but not all. To
                    check if you can use eSIMs on your device, please have a
                    look at our{" "}
                    <button
                      className="font-medium text-primary underline hover:no-underline"
                      onClick={() => setDeviceCompatibilityOpen(true)}
                      type="button"
                    >
                      device compatibility list
                    </button>
                    .
                  </>
                ),
              },
              {
                id: "use",
                q: "How do I use my eSIM?",
                a: "To install the eSIM, a stable internet connection is necessary. You can install your eSIM with QR code or manually. You can access our installation guide after purchase in your account. Consider setting up the eSIM before traveling abroad.",
              },
              {
                id: "many",
                q: "How many eSIMs can I have?",
                a: "Some devices allow you to install multiple eSIMs; the number of active eSIMs at the same time can vary depending on the device model. You can continue using your regular SIM card while using an eSIM.",
              },
              {
                id: "phone-number",
                q: "Does my eSIM come with a phone number?",
                a: "Data-only eSIM plans do not include a phone number. If you need voice or SMS, look for DATA-VOICE-SMS packages in the store.",
              },
              {
                id: "how-long",
                q: "How long can I use an eSIM?",
                a: "Validity depends on the plan you buy (e.g. 7, 14, or 30 days, or longer). Your plan is active from the moment you activate it, so activate when you're ready to use it.",
              },
              {
                id: "data-usage",
                q: "How can I check my current data usage?",
                a: "After purchase, you can view your eSIM and data usage in your account under My eSIMs. Your provider may also send usage alerts.",
              },
              {
                id: "hotspot",
                q: "How do I share data with my eSIM or activate a hotspot?",
                a: "If your plan and device support it, you can turn on hotspot or tethering in your device settings. Support depends on your phone and the eSIM plan; check your plan details before buying.",
              },
              {
                id: "returns",
                q: "eSIM returns",
                a: "eSIMs are digital products. Once activated, they cannot be refunded. If you have not yet activated your eSIM and need a refund, contact us within 30 days of purchase at support@forthecult.store or via our Contact page.",
              },
            ].map((faq) => {
              const isOpen = faqOpenIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className={cn(
                    "rounded-lg border border-border bg-card transition-colors",
                    isOpen && "bg-muted/30",
                  )}
                >
                  <button
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-foreground"
                    onClick={() => toggleFaq(faq.id)}
                    type="button"
                  >
                    <span>{faq.q}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border">
                      {isOpen ? (
                        <Minus className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <EsimDeviceCompatibilityModal
        onOpenChange={setDeviceCompatibilityOpen}
        open={deviceCompatibilityOpen}
      />
    </div>
  );
}

function parseData(s: null | string): DataFilter {
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

function parseValidity(s: null | string): ValidityFilter {
  if (s === "7" || s === "14" || s === "30" || s === "30+") return s;
  return "all";
}
