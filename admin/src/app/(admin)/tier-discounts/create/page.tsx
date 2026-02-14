"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export default function AdminTierDiscountCreatePage() {
  const router = useRouter();
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [memberTier, setMemberTier] = useState(3);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"shipping" | "order" | "category" | "product">("order");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [appliesToEsim, setAppliesToEsim] = useState(false);

  const fetchOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/categories?limit=500`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/products?limit=500`, { credentials: "include" }),
      ]);
      if (catRes.ok) {
        const j = (await catRes.json()) as { items: CategoryOption[] };
        setCategoryOptions(j.items ?? []);
      }
      if (prodRes.ok) {
        const j = (await prodRes.json()) as { items: { id: string; name: string }[] };
        setProductOptions(j.items ?? []);
      }
    } catch {
      // non-blocking
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
        setError("Select a product or check “Apply to all eSIMs” when scope is Product.");
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
          productId: scope === "product" && !appliesToEsim ? productId.trim() || null : null,
          appliesToEsim: scope === "product" && appliesToEsim ? 1 : null,
        };
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Failed to create");
        }
        const data = (await res.json()) as { id: string };
        router.replace(`/tier-discounts/${data.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create");
      } finally {
        setSaving(false);
      }
    },
    [
      memberTier,
      label,
      scope,
      discountType,
      discountValue,
      categoryId,
      productId,
      appliesToEsim,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">New tier discount</h2>
        <Link href="/tier-discounts" className="text-sm text-muted-foreground hover:text-foreground">
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
            <p className="text-sm text-muted-foreground">
              Discounts stack per tier (e.g. Tier 3 can have 20% off shipping and 15% off eSIMs).
            </p>
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
                  <p className="text-xs text-muted-foreground">
                    When checked, discount applies to any cart item whose product ID starts with &quot;esim_&quot;.
                  </p>
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
                  onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
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
                  type={discountType === "percent" ? "number" : "number"}
                  min={0}
                  max={discountType === "percent" ? 100 : undefined}
                  step={discountType === "fixed" ? "0.01" : 1}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className={inputClass}
                  placeholder={discountType === "percent" ? "e.g. 20" : "e.g. 5.00"}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create tier discount"}
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
