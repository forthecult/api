"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

interface BrandOption {
  id: string;
  name: string;
}

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

const COUNTRY_OPTIONS: { label: string; value: string }[] = [
  { label: "All countries", value: "" },
  { label: "United States", value: "US" },
  { label: "Canada", value: "CA" },
  { label: "United Kingdom", value: "GB" },
  { label: "Australia", value: "AU" },
  { label: "Germany", value: "DE" },
  { label: "France", value: "FR" },
  { label: "Mexico", value: "MX" },
  { label: "Other (enter code)", value: "OTHER" },
];

export default function AdminShippingOptionEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandId, setBrandId] = useState("");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [estimatedDaysText, setEstimatedDaysText] = useState("");
  const [minOrderCents, setMinOrderCents] = useState<string>("");
  const [maxOrderCents, setMaxOrderCents] = useState<string>("");
  const [minQuantity, setMinQuantity] = useState<string>("");
  const [maxQuantity, setMaxQuantity] = useState<string>("");
  const [minWeightGrams, setMinWeightGrams] = useState<string>("");
  const [maxWeightGrams, setMaxWeightGrams] = useState<string>("");
  const [type, setType] = useState<
    "flat" | "flat_plus_per_item" | "free" | "per_item"
  >("flat");
  const [amountCents, setAmountCents] = useState<string>("");
  const [additionalItemCents, setAdditionalItemCents] = useState<string>("");
  const [priority, setPriority] = useState<string>("0");
  const [speed, setSpeed] = useState<"express" | "standard">("standard");

  const fetchOption = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/shipping-options/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const row = (await res.json()) as {
        additionalItemCents: null | number;
        amountCents: null | number;
        brandId: null | string;
        countryCode: null | string;
        estimatedDaysText: null | string;
        maxOrderCents: null | number;
        maxQuantity: null | number;
        maxWeightGrams: null | number;
        minOrderCents: null | number;
        minQuantity: null | number;
        minWeightGrams: null | number;
        name: string;
        priority: number;
        sourceUrl: null | string;
        speed: "express" | "standard";
        type: "flat" | "flat_plus_per_item" | "free" | "per_item";
      };
      setBrandId(row.brandId ?? "");
      setName(row.brandId ? "Standard Shipping" : row.name);
      setCountryCode(row.countryCode ?? "");
      setSourceUrl(row.sourceUrl ?? "");
      setEstimatedDaysText(row.estimatedDaysText ?? "");
      setMinOrderCents(
        row.minOrderCents != null ? (row.minOrderCents / 100).toFixed(2) : "",
      );
      setMaxOrderCents(
        row.maxOrderCents != null ? (row.maxOrderCents / 100).toFixed(2) : "",
      );
      setMinQuantity(row.minQuantity != null ? String(row.minQuantity) : "");
      setMaxQuantity(row.maxQuantity != null ? String(row.maxQuantity) : "");
      setMinWeightGrams(
        row.minWeightGrams != null ? String(row.minWeightGrams) : "",
      );
      setMaxWeightGrams(
        row.maxWeightGrams != null ? String(row.maxWeightGrams) : "",
      );
      setType(row.type);
      setAmountCents(
        row.amountCents != null ? (row.amountCents / 100).toFixed(2) : "",
      );
      setAdditionalItemCents(
        row.additionalItemCents != null
          ? (row.additionalItemCents / 100).toFixed(2)
          : "",
      );
      setPriority(String(row.priority));
      setSpeed(row.speed ?? "standard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchOption();
  }, [fetchOption]);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/brands?limit=500`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: BrandOption[] }) => setBrands(json.items ?? []))
      .catch(() => setBrands([]));
  }, []);

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
    if (
      type === "flat_plus_per_item" &&
      (!amountCents.trim() || !additionalItemCents.trim())
    ) {
      setError(
        "First item and each additional item amounts are required for Flat + per item.",
      );
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
        additionalItemCents:
          type === "flat_plus_per_item"
            ? (parseDollars(additionalItemCents) ?? 0)
            : null,
        amountCents:
          type === "free"
            ? null
            : type === "flat_plus_per_item"
              ? (parseDollars(amountCents) ?? 0)
              : type === "flat" || type === "per_item"
                ? (parseDollars(amountCents) ?? 0)
                : null,
        brandId: brandId.trim() || null,
        countryCode: countryCode.trim() || null,
        estimatedDaysText: estimatedDaysText.trim() || null,
        maxOrderCents: parseDollars(maxOrderCents) ?? null,
        maxQuantity: parseNum(maxQuantity) ?? null,
        maxWeightGrams: parseNum(maxWeightGrams) ?? null,
        minOrderCents: parseDollars(minOrderCents) ?? null,
        minQuantity: parseNum(minQuantity) ?? null,
        minWeightGrams: parseNum(minWeightGrams) ?? null,
        name: name.trim(),
        priority: parseNum(priority) ?? 0,
        sourceUrl: sourceUrl.trim() || null,
        speed,
        type,
      };
      const res = await fetch(`${API_BASE}/api/admin/shipping-options/${id}`, {
        body: JSON.stringify(body),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update");
      }
      router.push("/shipping-options");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`
        flex min-h-[200px] items-center justify-center text-muted-foreground
      `}
      >
        Loading…
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/shipping-options"
        >
          ← Back to list
        </Link>
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Edit shipping option
        </h2>
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/shipping-options"
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
              <div
                className={`
                rounded-md border border-destructive/50 bg-destructive/10 px-3
                py-2 text-sm text-destructive
              `}
              >
                {error}
              </div>
            )}

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="name">
                  Name
                </label>
                <input
                  className={inputClass}
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Standard US"
                  type="text"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="brand">
                  Brand (optional)
                </label>
                <select
                  className={inputClass}
                  id="brand"
                  onChange={(e) => {
                    const v = e.target.value;
                    setBrandId(v);
                    if (v.trim()) setName("Standard Shipping");
                  }}
                  value={brandId}
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
                <label className={labelClass} htmlFor="country">
                  Country
                </label>
                <select
                  className={inputClass}
                  id="country"
                  onChange={(e) => setCountryCode(e.target.value)}
                  value={countryCode}
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="minOrder">
                  Min order value ($)
                </label>
                <input
                  className={inputClass}
                  id="minOrder"
                  inputMode="decimal"
                  onChange={(e) => setMinOrderCents(e.target.value)}
                  placeholder="e.g. 0"
                  type="text"
                  value={minOrderCents}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="maxOrder">
                  Max order value ($)
                </label>
                <input
                  className={inputClass}
                  id="maxOrder"
                  inputMode="decimal"
                  onChange={(e) => setMaxOrderCents(e.target.value)}
                  placeholder="leave empty for no max"
                  type="text"
                  value={maxOrderCents}
                />
              </div>
            </div>

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="minQty">
                  Min quantity
                </label>
                <input
                  className={inputClass}
                  id="minQty"
                  inputMode="numeric"
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder="leave empty for no min"
                  type="text"
                  value={minQuantity}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="maxQty">
                  Max quantity
                </label>
                <input
                  className={inputClass}
                  id="maxQty"
                  inputMode="numeric"
                  onChange={(e) => setMaxQuantity(e.target.value)}
                  placeholder="leave empty for no max"
                  type="text"
                  value={maxQuantity}
                />
              </div>
            </div>

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="minWeight">
                  Min weight (g)
                </label>
                <input
                  className={inputClass}
                  id="minWeight"
                  inputMode="numeric"
                  onChange={(e) => setMinWeightGrams(e.target.value)}
                  placeholder="leave empty for no min"
                  type="text"
                  value={minWeightGrams}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="maxWeight">
                  Max weight (g)
                </label>
                <input
                  className={inputClass}
                  id="maxWeight"
                  inputMode="numeric"
                  onChange={(e) => setMaxWeightGrams(e.target.value)}
                  placeholder="leave empty for no max"
                  type="text"
                  value={maxWeightGrams}
                />
              </div>
            </div>

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="type">
                  Type
                </label>
                <select
                  className={inputClass}
                  id="type"
                  onChange={(e) =>
                    setType(
                      e.target.value as
                        | "flat"
                        | "flat_plus_per_item"
                        | "free"
                        | "per_item",
                    )
                  }
                  value={type}
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
                  <label className={labelClass} htmlFor="amount">
                    Amount ($)
                  </label>
                  <input
                    className={inputClass}
                    id="amount"
                    inputMode="decimal"
                    onChange={(e) => setAmountCents(e.target.value)}
                    placeholder="e.g. 5.99"
                    type="text"
                    value={amountCents}
                  />
                </div>
              )}
              {type === "flat_plus_per_item" && (
                <>
                  <div className="space-y-2">
                    <label className={labelClass} htmlFor="amount">
                      First item ($)
                    </label>
                    <input
                      className={inputClass}
                      id="amount"
                      inputMode="decimal"
                      onChange={(e) => setAmountCents(e.target.value)}
                      placeholder="e.g. 5.00"
                      type="text"
                      value={amountCents}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass} htmlFor="additionalItemCents">
                      Each additional item ($)
                    </label>
                    <input
                      className={inputClass}
                      id="additionalItemCents"
                      inputMode="decimal"
                      onChange={(e) => setAdditionalItemCents(e.target.value)}
                      placeholder="e.g. 1.00"
                      type="text"
                      value={additionalItemCents}
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className={labelClass} htmlFor="priority">
                  Priority (lower = evaluated first)
                </label>
                <input
                  className={inputClass}
                  id="priority"
                  inputMode="numeric"
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="0"
                  type="text"
                  value={priority}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="speed">
                  Shipping speed
                </label>
                <select
                  className={inputClass}
                  id="speed"
                  onChange={(e) =>
                    setSpeed(e.target.value as "express" | "standard")
                  }
                  value={speed}
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                </select>
              </div>
            </div>

            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="sourceUrl">
                  Source URL (optional)
                </label>
                <input
                  className={inputClass}
                  id="sourceUrl"
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="e.g. https://pacsafe.com/pages/shipping"
                  type="url"
                  value={sourceUrl}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="estimatedDaysText">
                  Estimated delivery (optional)
                </label>
                <input
                  className={inputClass}
                  id="estimatedDaysText"
                  onChange={(e) => setEstimatedDaysText(e.target.value)}
                  placeholder="e.g. 2-7 business days"
                  type="text"
                  value={estimatedDaysText}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button disabled={submitting} type="submit">
                {submitting ? "Saving…" : "Save changes"}
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
