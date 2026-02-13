"use client";

import { Globe, Loader2, MapPin, Search, Signal, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { cn } from "~/lib/cn";
import { formatEsimPackageName } from "~/lib/esim-format";
import { useCart } from "~/lib/hooks/use-cart";
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

// ---------- Sub-components ----------

function PackageCard({
  pkg,
  onAddToCart,
}: {
  pkg: Package;
  onAddToCart?: (pkg: Package) => void;
}) {
  return (
    <Card className="group h-full transition-all hover:shadow-md hover:border-primary/30 flex flex-col">
      <Link href={`/esim/${pkg.id}`} className="flex flex-col flex-1 min-h-0">
        <CardContent className="flex flex-col gap-3 p-5 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {formatEsimPackageName(pkg.name)}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              {pkg.has5g && (
                <span
                  className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                  title="5G available"
                >
                  <Signal className="h-3 w-3" />
                  5G
                </span>
              )}
              {pkg.package_type === "DATA-VOICE-SMS" && (
                <Badge variant="secondary" className="text-[10px]">
                  Voice+SMS
                </Badge>
              )}
            </div>
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
          {(pkg.voice_quantity ?? 0) > 0 && (
            <div className="text-xs text-muted-foreground">
              {pkg.voice_quantity} {pkg.voice_unit} &middot;{" "}
              {pkg.sms_quantity} SMS
            </div>
          )}
          <div className="mt-auto pt-2 flex items-baseline justify-between border-t">
            <span className="text-xl font-bold text-primary">${pkg.price}</span>
            <span className="text-xs text-muted-foreground">
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
  const [activeTab, setActiveTab] = useState("countries");
  const [countries, setCountries] = useState<Country[]>([]);
  const [continents, setContinents] = useState<Continent[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedContinent, setSelectedContinent] =
    useState<Continent | null>(null);
  const [packageType, setPackageType] = useState<
    "DATA-ONLY" | "DATA-VOICE-SMS"
  >("DATA-ONLY");
  const [filterValidity, setFilterValidity] = useState<ValidityFilter>(
    () => parseValidity(searchParams.get("validity")),
  );
  const [filterData, setFilterData] = useState<DataFilter>(() =>
    parseData(searchParams.get("data")),
  );

  // Fetch countries
  useEffect(() => {
    fetch("/api/esim/countries")
      .then((res) => res.json())
      .then((data: { status: boolean; data?: Country[] }) => {
        if (data.status && data.data) {
          setCountries(data.data);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch continents
  useEffect(() => {
    fetch("/api/esim/continents")
      .then((res) => res.json())
      .then((data: { status: boolean; data?: Continent[] }) => {
        if (data.status && data.data) {
          setContinents(data.data);
        }
      })
      .catch(console.error);
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

  // Sync filter to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (filterValidity === "all") params.delete("validity");
    else params.set("validity", filterValidity);
    if (filterData === "all") params.delete("data");
    else params.set("data", filterData);
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
      <Tabs value={activeTab} onValueChange={(v: string) => { setActiveTab(v); clearSelection(); }}>
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
                  No countries found matching &ldquo;{searchQuery}&rdquo;
                </p>
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
                    {filteredPackages.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                  {filteredPackages.length === 0 && (
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
                    {filteredPackages.map((pkg) => (
                      <PackageCard
                        key={pkg.id}
                        pkg={pkg}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                  {filteredPackages.length === 0 && (
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
                {filteredPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
              {filteredPackages.length === 0 && (
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
      <section className="mt-16 border-t pt-12">
        <h2 className="text-2xl font-bold text-center mb-8">
          How eSIM Works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg font-bold text-primary">1</span>
            </div>
            <h3 className="font-semibold">Choose a Plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a country or region and pick a data plan that fits your
              needs.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg font-bold text-primary">2</span>
            </div>
            <h3 className="font-semibold">Purchase &amp; Install</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete your purchase and scan the QR code or tap the activation
              link on your device.
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-lg font-bold text-primary">3</span>
            </div>
            <h3 className="font-semibold">Stay Connected</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your eSIM activates instantly. Enjoy high-speed data wherever you
              go.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
