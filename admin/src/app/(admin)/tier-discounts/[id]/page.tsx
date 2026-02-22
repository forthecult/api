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

interface CategoryOption {
  id: string;
  name: string;
}
interface ProductOption {
  id: string;
  name: string;
}

const SCOPES = [
  { label: "Shipping", value: "shipping" },
  { label: "Order (subtotal)", value: "order" },
  { label: "Category", value: "category" },
  { label: "Product / eSIM", value: "product" },
] as const;

interface TierDiscount {
  appliesToEsim: null | number;
  categoryId: null | string;
  createdAt: string;
  discountType: string;
  discountValue: number;
  id: string;
  label: null | string;
  memberTier: number;
  productId: null | string;
  scope: string;
  updatedAt: string;
}

export default function AdminTierDiscountEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [memberTier, setMemberTier] = useState(3);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<
    "category" | "order" | "product" | "shipping"
  >("order");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
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
      setDiscountType(data.discountType as "fixed" | "percent");
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
          appliesToEsim: scope === "product" && appliesToEsim ? 1 : null,
          categoryId: scope === "category" ? categoryId.trim() || null : null,
          discountType,
          discountValue: val,
          label: label.trim() || null,
          memberTier,
          productId:
            scope === "product" && !appliesToEsim
              ? productId.trim() || null
              : null,
          scope,
        };
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts/${id}`, {
          body: JSON.stringify(body),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Failed to update");
        }
        const updated = (await res.json()) as TierDiscount;
        setMemberTier(updated.memberTier);
        setLabel(updated.label ?? "");
        setScope(updated.scope as typeof scope);
        setDiscountType(updated.discountType as "fixed" | "percent");
        setDiscountValue(
          updated.discountType === "percent"
            ? String(updated.discountValue)
            : (updated.discountValue / 100).toFixed(2),
        );
        setCategoryId(updated.categoryId ?? "");
        setProductId(updated.productId ?? "");
        setAppliesToEsim(updated.appliesToEsim === 1);
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
      <div
        className={`
        flex min-h-[200px] items-center justify-center text-muted-foreground
      `}
      >
        Loading…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm text-muted-foreground
            hover:text-foreground
          `}
          href="/tier-discounts"
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
          className={`
            text-sm text-muted-foreground
            hover:text-foreground
          `}
          href="/tier-discounts"
        >
          ← Back to tier discounts
        </Link>
      </div>

      {error && (
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
        >
          {error}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Tier discount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="memberTier">
                  Member tier
                </label>
                <select
                  className={inputClass}
                  id="memberTier"
                  onChange={(e) => setMemberTier(Number(e.target.value))}
                  value={memberTier}
                >
                  {[1, 2, 3].map((t) => (
                    <option key={t} value={t}>
                      Tier {t} {t === 1 ? "(best)" : t === 3 ? "(entry)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="label">
                  Label (optional)
                </label>
                <input
                  className={inputClass}
                  id="label"
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Tier 3: 20% off shipping"
                  type="text"
                  value={label}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="scope">
                Scope
              </label>
              <select
                className={inputClass}
                id="scope"
                onChange={(e) => setScope(e.target.value as typeof scope)}
                value={scope}
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
                <label className={labelClass} htmlFor="categoryId">
                  Category
                </label>
                <select
                  className={inputClass}
                  disabled={optionsLoading}
                  id="categoryId"
                  onChange={(e) => setCategoryId(e.target.value)}
                  value={categoryId}
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
                      checked={appliesToEsim}
                      className="size-4 rounded border-input"
                      onChange={(e) => setAppliesToEsim(e.target.checked)}
                      type="checkbox"
                    />
                    <span className="text-sm">Apply to all eSIMs</span>
                  </label>
                </div>
                {!appliesToEsim && (
                  <div className="space-y-2">
                    <label className={labelClass} htmlFor="productId">
                      Product
                    </label>
                    <select
                      className={inputClass}
                      disabled={optionsLoading}
                      id="productId"
                      onChange={(e) => setProductId(e.target.value)}
                      value={productId}
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

            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="discountType">
                  Discount type
                </label>
                <select
                  className={inputClass}
                  id="discountType"
                  onChange={(e) =>
                    setDiscountType(e.target.value as "fixed" | "percent")
                  }
                  value={discountType}
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="discountValue">
                  Value {discountType === "percent" ? "(0–100)" : "($)"}
                </label>
                <input
                  className={inputClass}
                  id="discountValue"
                  max={discountType === "percent" ? 100 : undefined}
                  min={0}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  required
                  step={discountType === "fixed" ? "0.01" : 1}
                  type="number"
                  value={discountValue}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button disabled={saving} type="submit">
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
