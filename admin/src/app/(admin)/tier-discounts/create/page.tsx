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

export default function AdminTierDiscountCreatePage() {
  const router = useRouter();
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
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
        const res = await fetch(`${API_BASE}/api/admin/tier-discounts`, {
          body: JSON.stringify(body),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
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
        <h2 className="text-2xl font-semibold tracking-tight">
          New tier discount
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
            <p className="text-sm text-muted-foreground">
              Discounts stack per tier (e.g. Tier 3 can have 20% off shipping
              and 15% off eSIMs).
            </p>
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
                  <p className="text-xs text-muted-foreground">
                    When checked, discount applies to any cart item whose
                    product ID starts with &quot;esim_&quot;.
                  </p>
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
                  placeholder={
                    discountType === "percent" ? "e.g. 20" : "e.g. 5.00"
                  }
                  required
                  step={discountType === "fixed" ? "0.01" : 1}
                  type={discountType === "percent" ? "number" : "number"}
                  value={discountValue}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button disabled={saving} type="submit">
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
