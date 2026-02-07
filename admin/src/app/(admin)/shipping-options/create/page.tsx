"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All countries" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "MX", label: "Mexico" },
  { value: "OTHER", label: "Other (enter code)" },
];

type BrandOption = { id: string; name: string };

export default function AdminShippingOptionCreatePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [minOrderCents, setMinOrderCents] = useState<string>("");
  const [maxOrderCents, setMaxOrderCents] = useState<string>("");
  const [minQuantity, setMinQuantity] = useState<string>("");
  const [maxQuantity, setMaxQuantity] = useState<string>("");
  const [minWeightGrams, setMinWeightGrams] = useState<string>("");
  const [maxWeightGrams, setMaxWeightGrams] = useState<string>("");
  const [type, setType] = useState<"flat" | "per_item" | "flat_plus_per_item" | "free">("flat");
  const [amountCents, setAmountCents] = useState<string>("");
  const [additionalItemCents, setAdditionalItemCents] = useState<string>("");
  const [priority, setPriority] = useState<string>("0");
  const [speed, setSpeed] = useState<"standard" | "express">("standard");
  const [sourceUrl, setSourceUrl] = useState("");
  const [estimatedDaysText, setEstimatedDaysText] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/brands?limit=500`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: BrandOption[] }) => setBrands(json.items ?? []))
      .catch(() => setBrands([]));
  }, []);

  // When a brand is selected, default name to "Standard Shipping" for branded methods
  useEffect(() => {
    if (brandId.trim()) setName("Standard Shipping");
  }, [brandId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if ((type === "flat" || type === "per_item") && !amountCents.trim()) {
      setError("Amount is required for flat and per-item options.");
      return;
    }
    setSubmitting(true);
    try {
      const parseNum = (s: string) =>
        s.trim() === "" ? null : Number.parseInt(s, 10);
      const parseDollars = (s: string) => {
        if (s.trim() === "") return null;
        const n = Number.parseFloat(s);
        return Number.isFinite(n) ? Math.round(n * 100) : null;
      };
      const body = {
        name: name.trim(),
        countryCode: countryCode.trim() || null,
        minOrderCents: parseDollars(minOrderCents) ?? null,
        maxOrderCents: parseDollars(maxOrderCents) ?? null,
        minQuantity: parseNum(minQuantity) ?? null,
        maxQuantity: parseNum(maxQuantity) ?? null,
        minWeightGrams: parseNum(minWeightGrams) ?? null,
        maxWeightGrams: parseNum(maxWeightGrams) ?? null,
        type,
        amountCents:
          type === "free"
            ? null
            : type === "flat_plus_per_item"
              ? (parseDollars(amountCents) ?? 0)
              : (type === "flat" || type === "per_item" ? (parseDollars(amountCents) ?? 0) : null),
        additionalItemCents:
          type === "flat_plus_per_item"
            ? (parseDollars(additionalItemCents) ?? 0)
            : null,
        priority: parseNum(priority) ?? 0,
        speed,
        brandId: brandId.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
        estimatedDaysText: estimatedDaysText.trim() || null,
      };
      const res = await fetch(`${API_BASE}/api/admin/shipping-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create");
      }
      router.push("/shipping-options");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Create shipping option
        </h2>
        <Link
          href="/shipping-options"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to list
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Shipping option details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. Standard US"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="brand" className={labelClass}>
                  Brand (optional)
                </label>
                <select
                  id="brand"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Global (all brands)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="country" className={labelClass}>
                  Country
                </label>
                <select
                  id="country"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className={inputClass}
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="minOrder" className={labelClass}>
                  Min order value ($)
                </label>
                <input
                  id="minOrder"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 0"
                  value={minOrderCents}
                  onChange={(e) => setMinOrderCents(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="maxOrder" className={labelClass}>
                  Max order value ($)
                </label>
                <input
                  id="maxOrder"
                  type="text"
                  inputMode="decimal"
                  placeholder="leave empty for no max"
                  value={maxOrderCents}
                  onChange={(e) => setMaxOrderCents(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="minQty" className={labelClass}>
                  Min quantity
                </label>
                <input
                  id="minQty"
                  type="text"
                  inputMode="numeric"
                  placeholder="leave empty for no min"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="maxQty" className={labelClass}>
                  Max quantity
                </label>
                <input
                  id="maxQty"
                  type="text"
                  inputMode="numeric"
                  placeholder="leave empty for no max"
                  value={maxQuantity}
                  onChange={(e) => setMaxQuantity(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="minWeight" className={labelClass}>
                  Min weight (g)
                </label>
                <input
                  id="minWeight"
                  type="text"
                  inputMode="numeric"
                  placeholder="leave empty for no min"
                  value={minWeightGrams}
                  onChange={(e) => setMinWeightGrams(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="maxWeight" className={labelClass}>
                  Max weight (g)
                </label>
                <input
                  id="maxWeight"
                  type="text"
                  inputMode="numeric"
                  placeholder="leave empty for no max"
                  value={maxWeightGrams}
                  onChange={(e) => setMaxWeightGrams(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="type" className={labelClass}>
                  Type
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) =>
                    setType(
                      e.target.value as
                        | "flat"
                        | "per_item"
                        | "flat_plus_per_item"
                        | "free",
                    )
                  }
                  className={inputClass}
                >
                  <option value="flat">Flat rate</option>
                  <option value="per_item">Per item</option>
                  <option value="flat_plus_per_item">
                    Flat + per item (e.g. $5 first, $1 each additional)
                  </option>
                  <option value="free">Free shipping</option>
                </select>
              </div>
              {(type === "flat" || type === "per_item") && (
                <div className="space-y-2">
                  <label htmlFor="amount" className={labelClass}>
                    Amount ($)
                  </label>
                  <input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5.99"
                    value={amountCents}
                    onChange={(e) => setAmountCents(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
              {type === "flat_plus_per_item" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="amount" className={labelClass}>
                      First item ($)
                    </label>
                    <input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 5.00"
                      value={amountCents}
                      onChange={(e) => setAmountCents(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="additionalItemCents" className={labelClass}>
                      Each additional item ($)
                    </label>
                    <input
                      id="additionalItemCents"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 1.00"
                      value={additionalItemCents}
                      onChange={(e) => setAdditionalItemCents(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label htmlFor="priority" className={labelClass}>
                  Priority (lower = evaluated first)
                </label>
                <input
                  id="priority"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="speed" className={labelClass}>
                  Shipping speed
                </label>
                <select
                  id="speed"
                  value={speed}
                  onChange={(e) =>
                    setSpeed(e.target.value as "standard" | "express")
                  }
                  className={inputClass}
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="sourceUrl" className={labelClass}>
                  Source URL (optional)
                </label>
                <input
                  id="sourceUrl"
                  type="url"
                  placeholder="e.g. https://pacsafe.com/pages/shipping"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="estimatedDaysText" className={labelClass}>
                  Estimated delivery (optional)
                </label>
                <input
                  id="estimatedDaysText"
                  type="text"
                  placeholder="e.g. 2-7 business days"
                  value={estimatedDaysText}
                  onChange={(e) => setEstimatedDaysText(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Create shipping option"}
              </Button>
              <Link href="/shipping-options">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
