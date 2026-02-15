"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type CategoryOption = { id: string; name: string };
type ProductOption = { id: string; name: string };

const SCOPES = [
  { value: "shipping", label: "Shipping" },
  { value: "order", label: "Order (subtotal)" },
  { value: "category", label: "Category" },
  { value: "product", label: "Product / eSIM" },
] as const;

type TierDiscount = {
  id: string;
  memberTier: number;
  label: string | null;
  scope: string;
  discountType: string;
  discountValue: number;
  categoryId: string | null;
  productId: string | null;
  appliesToEsim: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminTierDiscountEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [memberTier, setMemberTier] = useState(3);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<
    "shipping" | "order" | "category" | "product"
  >("order");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [appliesToEsim, setAppliesToEsim] = useState(false);

  const fetchDiscount = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/tier-discounts/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setNotFound(false);
      const data = (await res.json()) as TierDiscount;
      setMemberTier(data.memberTier);
      setLabel(data.label ?? "");
      setScope(data.scope as typeof scope);
      setDiscountType(data.discountType as "percent" | "fixed");
      setDiscountValue(
        data.discountType === "percent"
          ? String(data.discountValue)
          : (data.discountValue / 100).toFixed(2),
      );
      setCategoryId(data.categoryId ?? "");
      setProductId(data.productId ?? "");
      setAppliesToEsim(data.appliesToEsim === 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/categories?limit=500`, {
          credentials: "include",
        }),
        fetch(`${API_BASE}/api/admin/products?limit=500`, {
          credentials: "include",
        }),
      ]);
      if (catRes.ok) {
        const j = (await catRes.json()) as { items: CategoryOption[] };
        setCategoryOptions(j.items ?? []);
      }
      if (prodRes.ok) {
        const j = (await prodRes.json()) as {
          items: { id: string; name: string }[];
        };
        setProductOptions(j.items ?? []);
      }
    } catch {
      // non-blocking
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDiscount();
    void fetchOptions();
  }, [fetchDiscount, fetchOptions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setError(null);
      const val =
        discountType === "percent"
          ? Number.parseInt(discountValue, 10)
          : Math.round(Number.parseFloat(discountValue || "0") * 100);
      if (Number.isNaN(val) || val < 0) {
        setError("Discount value must be a non-negative number.");
        return;
      }
      if (discountType === "percent" && val > 100) {
        setError("Percent discount must be 0–100.");
        return;
      }
      if (scope === "category" && !categoryId.trim()) {
        setError("Select a category when scope is Category.");
        return;
      }
      if (scope === "product" && !productId.trim() && !appliesToEsim) {
        setError(
          "Select a product or check “Apply to all eSIMs” when scope is Product.",
        );
        return;
      }
      setSaving(true);
      try {
        const body: Record<string, unknown> = {
          memberTier,
          label: label.trim() || null,
          scope,
          discountType,
          discountValue: val,
          categoryId: scope === "category" ? categoryId.trim() || null : null,
          productId:
            scope === "product" && !appliesToEsim
              ? productId.trim() || null
              : null,
          appliesToEsim: scope === "product" && appliesToEsim ? 1 : null,
        };
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Failed to update");
        }
        void fetchDiscount();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      memberTier,
      label,
      scope,
      discountType,
      discountValue,
      categoryId,
      productId,
      appliesToEsim,
      fetchDiscount,
    ],
  );

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link
          href="/tier-discounts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to tier discounts
        </Link>
        <p className="text-muted-foreground">Tier discount not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Edit tier discount
        </h2>
        <Link
          href="/tier-discounts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to tier discounts
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tier discount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="memberTier" className={labelClass}>
                  Member tier
                </label>
                <select
                  id="memberTier"
                  value={memberTier}
                  onChange={(e) => setMemberTier(Number(e.target.value))}
                  className={inputClass}
                >
                  {[1, 2, 3, 4].map((t) => (
                    <option key={t} value={t}>
                      Tier {t} {t === 1 ? "(best)" : t === 4 ? "(entry)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="label" className={labelClass}>
                  Label (optional)
                </label>
                <input
                  id="label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Tier 3: 20% off shipping"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="scope" className={labelClass}>
                Scope
              </label>
              <select
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as typeof scope)}
                className={inputClass}
              >
                {SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {scope === "category" && (
              <div className="space-y-2">
                <label htmlFor="categoryId" className={labelClass}>
                  Category
                </label>
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                  disabled={optionsLoading}
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === "product" && (
              <>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={appliesToEsim}
                      onChange={(e) => setAppliesToEsim(e.target.checked)}
                      className="size-4 rounded border-input"
                    />
                    <span className="text-sm">Apply to all eSIMs</span>
                  </label>
                </div>
                {!appliesToEsim && (
                  <div className="space-y-2">
                    <label htmlFor="productId" className={labelClass}>
                      Product
                    </label>
                    <select
                      id="productId"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className={inputClass}
                      disabled={optionsLoading}
                    >
                      <option value="">Select product</option>
                      {productOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="discountType" className={labelClass}>
                  Discount type
                </label>
                <select
                  id="discountType"
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as "percent" | "fixed")
                  }
                  className={inputClass}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="discountValue" className={labelClass}>
                  Value {discountType === "percent" ? "(0–100)" : "($)"}
                </label>
                <input
                  id="discountValue"
                  type="number"
                  min={0}
                  max={discountType === "percent" ? 100 : undefined}
                  step={discountType === "fixed" ? "0.01" : 1}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/tier-discounts">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
