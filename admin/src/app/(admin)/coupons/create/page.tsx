"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Payment method keys from the main app's PAYMENT_METHOD_DEFAULTS. */
const PAYMENT_METHOD_OPTIONS: { key: string; label: string }[] = [
  { key: "stripe", label: "Stripe (Credit / Debit card)" },
  { key: "paypal", label: "PayPal" },
  { key: "crypto_bitcoin", label: "Bitcoin (BTC)" },
  { key: "crypto_dogecoin", label: "Dogecoin (DOGE)" },
  { key: "crypto_ethereum", label: "Ethereum (ETH)" },
  { key: "crypto_solana", label: "Solana (SOL)" },
  { key: "crypto_monero", label: "Monero (XMR)" },
  { key: "crypto_crust", label: "Crustafarian (CRUST)" },
  { key: "crypto_pump", label: "Pump (PUMP)" },
  { key: "crypto_troll", label: "Troll (TROLL)" },
  { key: "crypto_sui", label: "Sui (SUI)" },
  { key: "crypto_ton", label: "TON" },
  { key: "stablecoin_usdc", label: "USDC (Stablecoin)" },
  { key: "stablecoin_usdt", label: "USDT (Stablecoin)" },
];

export default function AdminDiscountCreatePage() {
  const router = useRouter();
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [label, setLabel] = useState("");
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
  const [appliesTo, setAppliesTo] = useState<
    "subtotal" | "shipping" | "product"
  >("subtotal");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [tokenHolderChain, setTokenHolderChain] = useState<string>("");
  const [tokenHolderTokenAddress, setTokenHolderTokenAddress] = useState("");
  const [tokenHolderMinBalance, setTokenHolderMinBalance] = useState("");
  const [rulePaymentMethodKey, setRulePaymentMethodKey] = useState("");
  // Automatic discount ruleset (display in $, send as cents)
  const [ruleSubtotalMin, setRuleSubtotalMin] = useState("");
  const [ruleSubtotalMax, setRuleSubtotalMax] = useState("");
  const [ruleShippingMin, setRuleShippingMin] = useState("");
  const [ruleShippingMax, setRuleShippingMax] = useState("");
  const [ruleProductCountMin, setRuleProductCountMin] = useState("");
  const [ruleProductCountMax, setRuleProductCountMax] = useState("");
  const [ruleOrderTotalMin, setRuleOrderTotalMin] = useState("");
  const [ruleOrderTotalMax, setRuleOrderTotalMax] = useState("");

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

  // Sync discountKind ↔ appliesTo bidirectionally
  const handleAppliesToChange = useCallback(
    (value: "subtotal" | "shipping" | "product") => {
      setAppliesTo(value);
      if (value === "shipping") setDiscountKind("free_shipping");
      else if (value === "product") setDiscountKind("amount_off_products");
      else setDiscountKind("amount_off_order");
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      const codeTrim = method === "code" ? code.trim().toUpperCase() : "";
      if (method === "code" && !codeTrim) {
        setError("Discount code is required when method is Code.");
        return;
      }
      const val =
        discountKind !== "free_shipping" && discountKind !== "buy_x_get_y"
          ? discountType === "percent"
            ? Number.parseInt(discountValue, 10)
            : Math.round(Number.parseFloat(discountValue || "0") * 100)
          : discountKind === "free_shipping"
            ? 100
            : 0;
      if (
        discountKind !== "free_shipping" &&
        discountKind !== "buy_x_get_y" &&
        (Number.isNaN(val) || val < 0)
      ) {
        setError("Discount value must be a non-negative number.");
        return;
      }
      if (
        discountKind !== "free_shipping" &&
        discountKind !== "buy_x_get_y" &&
        discountType === "percent" &&
        val > 100
      ) {
        setError("Percent discount must be 0–100.");
        return;
      }
      if (discountKind === "buy_x_get_y") {
        const buy = Number.parseInt(buyQuantity, 10);
        const get = Number.parseInt(getQuantity, 10);
        if (Number.isNaN(buy) || buy < 1 || Number.isNaN(get) || get < 1) {
          setError(
            "Buy X get Y: buy quantity and get quantity must be at least 1.",
          );
          return;
        }
      }
      setSaving(true);
      try {
        const body: Record<string, unknown> = {
          label: label.trim() || null,
          method,
          code: codeTrim || undefined,
          dateStart: dateStart ? new Date(dateStart).toISOString() : null,
          dateEnd: dateEnd ? new Date(dateEnd).toISOString() : null,
          discountKind,
          discountType:
            discountKind === "free_shipping" ? "percent" : discountType,
          discountValue: discountKind === "free_shipping" ? 100 : val,
          appliesTo:
            discountKind === "free_shipping" ? "shipping" : appliesTo,
          maxUses: maxUses.trim() ? Number.parseInt(maxUses, 10) : null,
          maxUsesPerCustomer: maxUsesPerCustomer.trim()
            ? Number.parseInt(maxUsesPerCustomer, 10)
            : null,
          maxUsesPerCustomerType: maxUsesPerCustomerType || null,
          categoryIds,
          productIds,
        };
        if (method === "automatic") {
          body.rulePaymentMethodKey = rulePaymentMethodKey.trim() || null;
          body.ruleSubtotalMinCents = ruleSubtotalMin.trim()
            ? Math.round(Number.parseFloat(ruleSubtotalMin) * 100)
            : null;
          body.ruleSubtotalMaxCents = ruleSubtotalMax.trim()
            ? Math.round(Number.parseFloat(ruleSubtotalMax) * 100)
            : null;
          body.ruleShippingMinCents = ruleShippingMin.trim()
            ? Math.round(Number.parseFloat(ruleShippingMin) * 100)
            : null;
          body.ruleShippingMaxCents = ruleShippingMax.trim()
            ? Math.round(Number.parseFloat(ruleShippingMax) * 100)
            : null;
          body.ruleProductCountMin = ruleProductCountMin.trim()
            ? Number.parseInt(ruleProductCountMin, 10)
            : null;
          body.ruleProductCountMax = ruleProductCountMax.trim()
            ? Number.parseInt(ruleProductCountMax, 10)
            : null;
          body.ruleOrderTotalMinCents = ruleOrderTotalMin.trim()
            ? Math.round(Number.parseFloat(ruleOrderTotalMin) * 100)
            : null;
          body.ruleOrderTotalMaxCents = ruleOrderTotalMax.trim()
            ? Math.round(Number.parseFloat(ruleOrderTotalMax) * 100)
            : null;
        }
        if (discountKind === "buy_x_get_y") {
          body.buyQuantity = Number.parseInt(buyQuantity, 10) || null;
          body.getQuantity = Number.parseInt(getQuantity, 10) || null;
          body.getDiscountType = getDiscountType;
          body.getDiscountValue =
            getDiscountType === "percent"
              ? Number.parseInt(getDiscountValue, 10) || 0
              : Math.round(Number.parseFloat(getDiscountValue || "0") * 100);
        }
        const res = await fetch(`${API_BASE}/api/admin/coupons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Failed to create");
        }
        const data = (await res.json()) as { id: string };
        router.replace(`/coupons/${data.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create");
      } finally {
        setSaving(false);
      }
    },
    [
      method,
      code,
      dateStart,
      dateEnd,
      discountKind,
      discountType,
      discountValue,
      buyQuantity,
      getQuantity,
      getDiscountType,
      getDiscountValue,
      maxUses,
      maxUsesPerCustomer,
      maxUsesPerCustomerType,
      tokenHolderChain,
      tokenHolderTokenAddress,
      tokenHolderMinBalance,
      rulePaymentMethodKey,
      categoryIds,
      productIds,
      ruleSubtotalMin,
      ruleSubtotalMax,
      ruleShippingMin,
      ruleShippingMax,
      ruleProductCountMin,
      ruleProductCountMax,
      ruleOrderTotalMin,
      ruleOrderTotalMax,
      appliesTo,
      router,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">New discount</h2>
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
            <div className="space-y-2">
              <label htmlFor="label" className={labelClass}>
                Label
              </label>
              <input
                id="label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputClass}
                placeholder="e.g. 10% off eSIMs with CULT"
              />
              <p className="text-xs text-muted-foreground">
                Internal label to help admins identify this discount. Not shown
                to customers.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass}>Apply</label>
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
                    <span className="text-sm">Requires code</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatic: applied at checkout when rules match. Code:
                  customer must enter a discount code.
                </p>
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
                    required
                  />
                </div>
              )}
              {method === "automatic" && (
                <div className="space-y-2">
                  <span className={labelClass}>Code</span>
                  <p className="text-sm text-muted-foreground">
                    Auto-generated (e.g. AUTO-…). Not shown to customers.
                  </p>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="appliesTo" className={labelClass}>
                  Applies to
                </label>
                <select
                  id="appliesTo"
                  value={appliesTo}
                  onChange={(e) =>
                    handleAppliesToChange(
                      e.target.value as "subtotal" | "shipping" | "product",
                    )
                  }
                  className={inputClass}
                >
                  <option value="subtotal">Order subtotal</option>
                  <option value="product">
                    Product (specific items / categories)
                  </option>
                  <option value="shipping">
                    Shipping only (e.g. free shipping)
                  </option>
                </select>
                {appliesTo === "product" && (
                  <p className="text-xs text-muted-foreground">
                    Discount is calculated on qualifying products only.
                    Select products or categories below to restrict which
                    items receive the discount.
                  </p>
                )}
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
                    placeholder="e.g. 2"
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
                    placeholder="e.g. 1"
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
                    placeholder={getDiscountType === "percent" ? "100" : "0"}
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

        {method === "automatic" && (
          <Card>
            <CardHeader>
              <CardTitle>When to apply (ruleset)</CardTitle>
              <p className="text-sm text-muted-foreground">
                All set conditions must be met for this automatic discount to
                apply. Leave a field empty for no limit. Amounts in $.
              </p>
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="mb-2 font-medium text-foreground">
                  Cart must contain (optional)
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    <strong>Specific product:</strong> Select one or more
                    products in the <strong>Products</strong> section below.
                    The discount applies only when at least one is in the cart.
                  </li>
                  <li>
                    <strong>Product from a category:</strong> Select one or
                    more categories in the <strong>Categories</strong> section
                    below. The discount applies only when the cart has at least
                    one product from one of those categories.
                  </li>
                </ul>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="rulePaymentMethodKey" className={labelClass}>
                  Payment method restriction
                </label>
                <select
                  id="rulePaymentMethodKey"
                  value={rulePaymentMethodKey}
                  onChange={(e) => setRulePaymentMethodKey(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Any payment method</option>
                  {PAYMENT_METHOD_OPTIONS.map((pm) => (
                    <option key={pm.key} value={pm.key}>
                      {pm.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  When set, this discount only applies when the customer pays
                  with the selected method. For example, set &quot;Troll
                  (TROLL)&quot; and a Troll category to give 5% off to $TROLL
                  buyers in that category.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <label htmlFor="ruleSubtotalMin" className={labelClass}>
                    Subtotal min ($)
                  </label>
                  <input
                    id="ruleSubtotalMin"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleSubtotalMin}
                    onChange={(e) => setRuleSubtotalMin(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleSubtotalMax" className={labelClass}>
                    Subtotal max ($)
                  </label>
                  <input
                    id="ruleSubtotalMax"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleSubtotalMax}
                    onChange={(e) => setRuleSubtotalMax(e.target.value)}
                    className={inputClass}
                    placeholder="No max"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleShippingMin" className={labelClass}>
                    Shipping min ($)
                  </label>
                  <input
                    id="ruleShippingMin"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleShippingMin}
                    onChange={(e) => setRuleShippingMin(e.target.value)}
                    className={inputClass}
                    placeholder="No min"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleShippingMax" className={labelClass}>
                    Shipping max ($)
                  </label>
                  <input
                    id="ruleShippingMax"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleShippingMax}
                    onChange={(e) => setRuleShippingMax(e.target.value)}
                    className={inputClass}
                    placeholder="No max"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <label htmlFor="ruleProductCountMin" className={labelClass}>
                    Product count min
                  </label>
                  <input
                    id="ruleProductCountMin"
                    type="number"
                    min={0}
                    step={1}
                    value={ruleProductCountMin}
                    onChange={(e) => setRuleProductCountMin(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Total quantity of items
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleProductCountMax" className={labelClass}>
                    Product count max
                  </label>
                  <input
                    id="ruleProductCountMax"
                    type="number"
                    min={0}
                    step={1}
                    value={ruleProductCountMax}
                    onChange={(e) => setRuleProductCountMax(e.target.value)}
                    className={inputClass}
                    placeholder="No max"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleOrderTotalMin" className={labelClass}>
                    Order total min ($)
                  </label>
                  <input
                    id="ruleOrderTotalMin"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleOrderTotalMin}
                    onChange={(e) => setRuleOrderTotalMin(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. 75"
                  />
                  <p className="text-xs text-muted-foreground">
                    Subtotal + shipping
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="ruleOrderTotalMax" className={labelClass}>
                    Order total max ($)
                  </label>
                  <input
                    id="ruleOrderTotalMax"
                    type="number"
                    min={0}
                    step={0.01}
                    value={ruleOrderTotalMax}
                    onChange={(e) => setRuleOrderTotalMax(e.target.value)}
                    className={inputClass}
                    placeholder="No max"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              wallet with at least the given token balance. Leave empty for no
              restriction.
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
                  <option value="evm">EVM</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="tokenHolderMinBalance" className={labelClass}>
                  Min balance
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
                placeholder="Solana mint or ERC20 contract"
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
            {optionsLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading categories…
              </p>
            ) : categoryOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {categoryOptions.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                      className="size-4 rounded border-input"
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            )}
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
              {optionsLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading products…
                </p>
              ) : productOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products.</p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {productOptions.map((p) => (
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
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create discount"}
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
