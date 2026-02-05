"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type CategoryOption = { id: string; name: string };
type ProductOption = { id: string; name: string };

type DiscountKind =
  | "amount_off_products"
  | "amount_off_order"
  | "buy_x_get_y"
  | "free_shipping";

export default function AdminDiscountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [method, setMethod] = useState<"automatic" | "code">("code");
  const [code, setCode] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [discountKind, setDiscountKind] =
    useState<DiscountKind>("amount_off_order");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [getQuantity, setGetQuantity] = useState("");
  const [getDiscountType, setGetDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [getDiscountValue, setGetDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [maxUsesPerCustomerType, setMaxUsesPerCustomerType] = useState<
    "account" | "phone" | "shipping_address" | ""
  >("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [redemptionCount, setRedemptionCount] = useState<number | null>(null);
  const [tokenHolderChain, setTokenHolderChain] = useState<string>("");
  const [tokenHolderTokenAddress, setTokenHolderTokenAddress] = useState("");
  const [tokenHolderMinBalance, setTokenHolderMinBalance] = useState("");

  const fetchCoupon = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Discount not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const row = (await res.json()) as {
        method?: "automatic" | "code";
        code: string;
        dateStart: string | null;
        dateEnd: string | null;
        discountKind?: DiscountKind;
        discountType: "percent" | "fixed";
        discountValue: number;
        appliesTo: "subtotal" | "shipping";
        buyQuantity?: number | null;
        getQuantity?: number | null;
        getDiscountType?: "percent" | "fixed" | null;
        getDiscountValue?: number | null;
        maxUses: number | null;
        maxUsesPerCustomer: number | null;
        maxUsesPerCustomerType: string | null;
        tokenHolderChain?: string | null;
        tokenHolderTokenAddress?: string | null;
        tokenHolderMinBalance?: string | null;
        categoryIds: string[];
        productIds: string[];
        redemptionCount?: number;
      };
      setMethod(row.method ?? "code");
      setCode(row.code);
      setDateStart(row.dateStart ? row.dateStart.slice(0, 16) : "");
      setDateEnd(row.dateEnd ? row.dateEnd.slice(0, 16) : "");
      setDiscountKind(row.discountKind ?? "amount_off_order");
      setDiscountType(row.discountType);
      setDiscountValue(
        row.discountType === "percent"
          ? String(row.discountValue)
          : (row.discountValue / 100).toFixed(2),
      );
      setBuyQuantity(row.buyQuantity != null ? String(row.buyQuantity) : "");
      setGetQuantity(row.getQuantity != null ? String(row.getQuantity) : "");
      setGetDiscountType(row.getDiscountType ?? "percent");
      setGetDiscountValue(
        row.getDiscountValue != null
          ? row.getDiscountType === "percent"
            ? String(row.getDiscountValue)
            : (row.getDiscountValue / 100).toFixed(2)
          : "",
      );
      setMaxUses(row.maxUses != null ? String(row.maxUses) : "");
      setMaxUsesPerCustomer(
        row.maxUsesPerCustomer != null ? String(row.maxUsesPerCustomer) : "",
      );
      setMaxUsesPerCustomerType(
        (row.maxUsesPerCustomerType as
          | "account"
          | "phone"
          | "shipping_address") ?? "",
      );
      setTokenHolderChain(row.tokenHolderChain ?? "");
      setTokenHolderTokenAddress(row.tokenHolderTokenAddress ?? "");
      setTokenHolderMinBalance(row.tokenHolderMinBalance ?? "");
      setCategoryIds(row.categoryIds ?? []);
      setProductIds(row.productIds ?? []);
      setRedemptionCount(row.redemptionCount ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load discount");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOptions = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void fetchCoupon();
    void fetchOptions();
  }, [fetchCoupon, fetchOptions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const codeTrim = code.trim().toUpperCase();
      if (!codeTrim) {
        setError("Discount code is required.");
        return;
      }
      const val =
        discountType === "percent"
          ? Number.parseInt(discountValue, 10)
          : Math.round(Number.parseFloat(discountValue) * 100);
      if (Number.isNaN(val) || val < 0) {
        setError("Discount value must be a non-negative number.");
        return;
      }
      if (discountType === "percent" && val > 100) {
        setError("Percent discount must be 0–100.");
        return;
      }
      setSaving(true);
      try {
        const appliesTo =
          discountKind === "free_shipping" ? "shipping" : "subtotal";
        const body = {
          code: codeTrim,
          dateStart: dateStart ? new Date(dateStart).toISOString() : null,
          dateEnd: dateEnd ? new Date(dateEnd).toISOString() : null,
          discountKind,
          discountType,
          discountValue: discountType === "percent" ? val : val,
          appliesTo,
          maxUses: maxUses.trim() ? Number.parseInt(maxUses, 10) : null,
          maxUsesPerCustomer: maxUsesPerCustomer.trim()
            ? Number.parseInt(maxUsesPerCustomer, 10)
            : null,
          maxUsesPerCustomerType: maxUsesPerCustomerType || null,
          tokenHolderChain: tokenHolderChain.trim() || null,
          tokenHolderTokenAddress: tokenHolderTokenAddress.trim() || null,
          tokenHolderMinBalance: tokenHolderMinBalance.trim() || null,
          categoryIds,
          productIds,
        };
        const res = await fetch(`${API_BASE}/api/admin/coupons/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Failed to save");
        }
        void fetchCoupon();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      code,
      dateStart,
      dateEnd,
      discountKind,
      discountType,
      discountValue,
      maxUses,
      maxUsesPerCustomer,
      maxUsesPerCustomerType,
      tokenHolderChain,
      tokenHolderTokenAddress,
      tokenHolderMinBalance,
      categoryIds,
      productIds,
      fetchCoupon,
    ],
  );

  const toggleCategory = useCallback((categoryId: string) => {
    setCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((c) => c !== categoryId)
        : [...prev, categoryId],
    );
  }, []);

  const toggleProduct = useCallback((productId: string) => {
    setProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((p) => p !== productId)
        : [...prev, productId],
    );
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !code) {
    return (
      <div className="space-y-4">
        <Link
          href="/coupons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to discounts
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit discount</h2>
        <Link
          href="/coupons"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to discounts
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
            <CardTitle>Discount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass}>Method</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      checked={method === "automatic"}
                      onChange={() => setMethod("automatic")}
                      className="size-4 border-input"
                    />
                    <span className="text-sm">Automatic</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="method"
                      checked={method === "code"}
                      onChange={() => setMethod("code")}
                      className="size-4 border-input"
                    />
                    <span className="text-sm">Code</span>
                  </label>
                </div>
              </div>
              {method === "code" && (
                <div className="space-y-2">
                  <label htmlFor="code" className={labelClass}>
                    Discount code
                  </label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={inputClass}
                    placeholder="e.g. SAVE20"
                    required={method === "code"}
                  />
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="discountKind" className={labelClass}>
                  Discount type
                </label>
                <select
                  id="discountKind"
                  value={discountKind}
                  onChange={(e) =>
                    setDiscountKind(e.target.value as DiscountKind)
                  }
                  className={inputClass}
                >
                  <option value="amount_off_products">
                    Amount off products
                  </option>
                  <option value="amount_off_order">Amount off order</option>
                  <option value="buy_x_get_y">Buy X, get Y</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="dateStart" className={labelClass}>
                  Date start
                </label>
                <input
                  id="dateStart"
                  type="datetime-local"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no start.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="dateEnd" className={labelClass}>
                  Date end
                </label>
                <input
                  id="dateEnd"
                  type="datetime-local"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no end.
                </p>
              </div>
            </div>
            {(discountKind === "amount_off_products" ||
              discountKind === "amount_off_order") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Amount type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="discountType"
                        checked={discountType === "percent"}
                        onChange={() => setDiscountType("percent")}
                        className="size-4 border-input"
                      />
                      <span className="text-sm">Percent (%)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="discountType"
                        checked={discountType === "fixed"}
                        onChange={() => setDiscountType("fixed")}
                        className="size-4 border-input"
                      />
                      <span className="text-sm">Fixed ($)</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="discountValue" className={labelClass}>
                    {discountType === "percent" ? "Discount %" : "Discount ($)"}
                  </label>
                  <input
                    id="discountValue"
                    type="number"
                    min={0}
                    max={discountType === "percent" ? 100 : undefined}
                    step={discountType === "percent" ? 1 : 0.01}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className={inputClass}
                    placeholder={
                      discountType === "percent" ? "e.g. 20" : "e.g. 10.00"
                    }
                    required
                  />
                </div>
              </div>
            )}

            {discountKind === "buy_x_get_y" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="buyQuantity" className={labelClass}>
                    Buy quantity (X)
                  </label>
                  <input
                    id="buyQuantity"
                    type="number"
                    min={1}
                    value={buyQuantity}
                    onChange={(e) => setBuyQuantity(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="getQuantity" className={labelClass}>
                    Get quantity (Y)
                  </label>
                  <input
                    id="getQuantity"
                    type="number"
                    min={1}
                    value={getQuantity}
                    onChange={(e) => setGetQuantity(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Get discount type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="getDiscountType"
                        checked={getDiscountType === "percent"}
                        onChange={() => setGetDiscountType("percent")}
                        className="size-4 border-input"
                      />
                      <span className="text-sm">Percent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="getDiscountType"
                        checked={getDiscountType === "fixed"}
                        onChange={() => setGetDiscountType("fixed")}
                        className="size-4 border-input"
                      />
                      <span className="text-sm">Fixed ($)</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="getDiscountValue" className={labelClass}>
                    Get discount value (
                    {getDiscountType === "percent" ? "%" : "$"})
                  </label>
                  <input
                    id="getDiscountValue"
                    type="number"
                    min={0}
                    max={getDiscountType === "percent" ? 100 : undefined}
                    step={getDiscountType === "percent" ? 1 : 0.01}
                    value={getDiscountValue}
                    onChange={(e) => setGetDiscountValue(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {discountKind === "free_shipping" && (
              <p className="text-sm text-muted-foreground">
                Free shipping: shipping cost will be discounted at checkout.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage limits</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total uses and per-customer limits. Leave empty for unlimited.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="maxUses" className={labelClass}>
                  Total times the code can be used
                </label>
                <input
                  id="maxUses"
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 1000"
                />
                {redemptionCount != null && (
                  <p className="text-xs text-muted-foreground">
                    Used {redemptionCount} time
                    {redemptionCount !== 1 ? "s" : ""} so far.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="maxUsesPerCustomer" className={labelClass}>
                  Times per customer (limit)
                </label>
                <input
                  id="maxUsesPerCustomer"
                  type="number"
                  min={1}
                  value={maxUsesPerCustomer}
                  onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                  className={inputClass}
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="maxUsesPerCustomerType" className={labelClass}>
                Per-customer is identified by
              </label>
              <select
                id="maxUsesPerCustomerType"
                value={maxUsesPerCustomerType}
                onChange={(e) =>
                  setMaxUsesPerCustomerType(
                    e.target.value as
                      | "account"
                      | "phone"
                      | "shipping_address"
                      | "",
                  )
                }
                className={inputClass}
              >
                <option value="">—</option>
                <option value="account">Account (logged-in user)</option>
                <option value="phone">Phone number</option>
                <option value="shipping_address">Shipping address</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token holder restriction</CardTitle>
            <p className="text-sm text-muted-foreground">
              Optional: only apply this discount when the customer has a linked
              wallet with at least the given token balance (e.g. free shipping or
              discount for CULT holders). Leave empty for no restriction.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="tokenHolderChain" className={labelClass}>
                  Chain
                </label>
                <select
                  id="tokenHolderChain"
                  value={tokenHolderChain}
                  onChange={(e) => setTokenHolderChain(e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="solana">Solana</option>
                  <option value="evm">EVM (Ethereum, Base, etc.)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="tokenHolderMinBalance" className={labelClass}>
                  Min balance (human-readable)
                </label>
                <input
                  id="tokenHolderMinBalance"
                  type="text"
                  value={tokenHolderMinBalance}
                  onChange={(e) => setTokenHolderMinBalance(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 1000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="tokenHolderTokenAddress" className={labelClass}>
                Token mint / contract address
              </label>
              <input
                id="tokenHolderTokenAddress"
                type="text"
                value={tokenHolderTokenAddress}
                onChange={(e) => setTokenHolderTokenAddress(e.target.value)}
                className={cn(inputClass, "font-mono text-xs")}
                placeholder="Solana mint or ERC20 contract (0x… or base58)"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              Categories this discount applies to. Leave all unchecked for all
              categories.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {categoryOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories.</p>
              ) : (
                categoryOptions.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      className="size-4 rounded border-input"
                    />
                    <span>{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <p className="text-sm text-muted-foreground">
              Products this discount applies to. Leave all unchecked for all
              products.
            </p>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto rounded border p-3">
              <div className="flex flex-wrap gap-4">
                {productOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products.</p>
                ) : (
                  productOptions.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={productIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        className="size-4 rounded border-input"
                      />
                      <span>{p.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/coupons")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
