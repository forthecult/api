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

interface CategoryOption {
  id: string;
  name: string;
}
type DiscountKind =
  | "amount_off_order"
  | "amount_off_products"
  | "buy_x_get_y"
  | "free_shipping";

interface ProductOption {
  id: string;
  name: string;
}

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
  { key: "crypto_soluna", label: "SOLUNA (SOLUNA)" },
  { key: "crypto_seeker", label: "Seeker (SKR)" },
  { key: "crypto_cult", label: "Culture (CULT)" },
  { key: "crypto_sui", label: "Sui (SUI)" },
  { key: "crypto_ton", label: "TON" },
  { key: "stablecoin_usdc", label: "USDC (Stablecoin)" },
  { key: "stablecoin_usdt", label: "USDT (Stablecoin)" },
];

export default function AdminDiscountCreatePage() {
  const router = useRouter();
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  const [label, setLabel] = useState("");
  const [method, setMethod] = useState<"automatic" | "code">("code");
  const [code, setCode] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [discountKind, setDiscountKind] =
    useState<DiscountKind>("amount_off_order");
  const [discountType, setDiscountType] = useState<"fixed" | "percent">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [getQuantity, setGetQuantity] = useState("");
  const [getDiscountType, setGetDiscountType] = useState<"fixed" | "percent">(
    "percent",
  );
  const [getDiscountValue, setGetDiscountValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [maxUsesPerCustomerType, setMaxUsesPerCustomerType] = useState<
    "" | "account" | "phone" | "shipping_address"
  >("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [ruleAppliesToEsim, setRuleAppliesToEsim] = useState(false);
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

  const handleDiscountKindChange = useCallback(
    (value: DiscountKind) => {
      setDiscountKind(value);
      if (value === "free_shipping") {
        if (!discountValue) setDiscountValue("100");
        setDiscountType("percent");
      }
    },
    [discountValue],
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
        discountKind !== "buy_x_get_y"
          ? discountType === "percent"
            ? Number.parseInt(discountValue, 10)
            : Math.round(Number.parseFloat(discountValue || "0") * 100)
          : 0;
      if (discountKind !== "buy_x_get_y" && (Number.isNaN(val) || val < 0)) {
        setError("Discount value must be a non-negative number.");
        return;
      }
      if (
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
          appliesTo:
            discountKind === "free_shipping"
              ? "shipping"
              : discountKind === "amount_off_products"
                ? "product"
                : "subtotal",
          categoryIds,
          code: codeTrim || undefined,
          dateEnd: dateEnd ? new Date(dateEnd).toISOString() : null,
          dateStart: dateStart ? new Date(dateStart).toISOString() : null,
          discountKind,
          discountType,
          discountValue: val,
          label: label.trim() || null,
          maxUses: maxUses.trim() ? Number.parseInt(maxUses, 10) : null,
          maxUsesPerCustomer: maxUsesPerCustomer.trim()
            ? Number.parseInt(maxUsesPerCustomer, 10)
            : null,
          maxUsesPerCustomerType: maxUsesPerCustomerType || null,
          method,
          productIds,
          ruleAppliesToEsim: ruleAppliesToEsim ? 1 : null,
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
      ruleAppliesToEsim,
      ruleSubtotalMin,
      ruleSubtotalMax,
      ruleShippingMin,
      ruleShippingMax,
      ruleProductCountMin,
      ruleProductCountMax,
      ruleOrderTotalMin,
      ruleOrderTotalMax,
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
          className={`
            text-sm text-muted-foreground
            hover:text-foreground
          `}
          href="/coupons"
        >
          ← Back to discounts
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
            <CardTitle>Discount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="label">
                Label
              </label>
              <input
                className={inputClass}
                id="label"
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. 10% off eSIMs with CULT"
                type="text"
                value={label}
              />
              <p className="text-xs text-muted-foreground">
                Internal label to help admins identify this discount. Not shown
                to customers.
              </p>
            </div>
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass}>Apply</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      checked={method === "automatic"}
                      className="size-4 border-input"
                      name="method"
                      onChange={() => setMethod("automatic")}
                      type="radio"
                    />
                    <span className="text-sm">Automatic</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      checked={method === "code"}
                      className="size-4 border-input"
                      name="method"
                      onChange={() => setMethod("code")}
                      type="radio"
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
                  <label className={labelClass} htmlFor="code">
                    Discount code
                  </label>
                  <input
                    className={inputClass}
                    id="code"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE20"
                    required
                    type="text"
                    value={code}
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
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="discountKind">
                  Discount type
                </label>
                <select
                  className={inputClass}
                  id="discountKind"
                  onChange={(e) =>
                    handleDiscountKindChange(e.target.value as DiscountKind)
                  }
                  value={discountKind}
                >
                  <option value="amount_off_products">
                    Amount of products
                  </option>
                  <option value="amount_off_order">Amount of subtotal</option>
                  <option value="free_shipping">Shipping discount</option>
                  <option value="buy_x_get_y">Buy X, get Y</option>
                </select>
                {discountKind === "amount_off_products" && (
                  <p className="text-xs text-muted-foreground">
                    Discount is calculated on qualifying products only. Select
                    products or categories below to restrict which items receive
                    the discount.
                  </p>
                )}
              </div>
            </div>
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="dateStart">
                  Date start
                </label>
                <input
                  className={inputClass}
                  id="dateStart"
                  onChange={(e) => setDateStart(e.target.value)}
                  type="datetime-local"
                  value={dateStart}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no start.
                </p>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="dateEnd">
                  Date end
                </label>
                <input
                  className={inputClass}
                  id="dateEnd"
                  onChange={(e) => setDateEnd(e.target.value)}
                  type="datetime-local"
                  value={dateEnd}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no end.
                </p>
              </div>
            </div>
            {(discountKind === "amount_off_products" ||
              discountKind === "amount_off_order" ||
              discountKind === "free_shipping") && (
              <div
                className={`
                grid gap-4
                sm:grid-cols-2
              `}
              >
                <div className="space-y-2">
                  <label className={labelClass}>Amount type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        checked={discountType === "percent"}
                        className="size-4 border-input"
                        name="discountType"
                        onChange={() => setDiscountType("percent")}
                        type="radio"
                      />
                      <span className="text-sm">Percent (%)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={discountType === "fixed"}
                        className="size-4 border-input"
                        name="discountType"
                        onChange={() => setDiscountType("fixed")}
                        type="radio"
                      />
                      <span className="text-sm">Fixed ($)</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="discountValue">
                    {discountType === "percent"
                      ? `Discount %${discountKind === "free_shipping" ? " off shipping" : ""}`
                      : `Discount ($)${discountKind === "free_shipping" ? " off shipping" : ""}`}
                  </label>
                  <input
                    className={inputClass}
                    id="discountValue"
                    max={discountType === "percent" ? 100 : undefined}
                    min={0}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={
                      discountType === "percent"
                        ? "e.g. 100 for free shipping"
                        : "e.g. 10.00"
                    }
                    required
                    step={discountType === "percent" ? 1 : 0.01}
                    type="number"
                    value={discountValue}
                  />
                  {discountKind === "free_shipping" && (
                    <p className="text-xs text-muted-foreground">
                      Set to 100% for free shipping, or a lower value for a
                      partial shipping discount.
                    </p>
                  )}
                </div>
              </div>
            )}

            {discountKind === "buy_x_get_y" && (
              <div
                className={`
                grid gap-4
                sm:grid-cols-2
              `}
              >
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="buyQuantity">
                    Buy quantity (X)
                  </label>
                  <input
                    className={inputClass}
                    id="buyQuantity"
                    min={1}
                    onChange={(e) => setBuyQuantity(e.target.value)}
                    placeholder="e.g. 2"
                    type="number"
                    value={buyQuantity}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="getQuantity">
                    Get quantity (Y)
                  </label>
                  <input
                    className={inputClass}
                    id="getQuantity"
                    min={1}
                    onChange={(e) => setGetQuantity(e.target.value)}
                    placeholder="e.g. 1"
                    type="number"
                    value={getQuantity}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Get discount type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        checked={getDiscountType === "percent"}
                        className="size-4 border-input"
                        name="getDiscountType"
                        onChange={() => setGetDiscountType("percent")}
                        type="radio"
                      />
                      <span className="text-sm">Percent</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={getDiscountType === "fixed"}
                        className="size-4 border-input"
                        name="getDiscountType"
                        onChange={() => setGetDiscountType("fixed")}
                        type="radio"
                      />
                      <span className="text-sm">Fixed ($)</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="getDiscountValue">
                    Get discount value (
                    {getDiscountType === "percent" ? "%" : "$"})
                  </label>
                  <input
                    className={inputClass}
                    id="getDiscountValue"
                    max={getDiscountType === "percent" ? 100 : undefined}
                    min={0}
                    onChange={(e) => setGetDiscountValue(e.target.value)}
                    placeholder={getDiscountType === "percent" ? "100" : "0"}
                    step={getDiscountType === "percent" ? 1 : 0.01}
                    type="number"
                    value={getDiscountValue}
                  />
                </div>
              </div>
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
              <div
                className={`
                rounded-md border border-border bg-muted/50 p-3 text-sm
                text-muted-foreground
              `}
              >
                <p className="mb-2 font-medium text-foreground">
                  Cart must contain (optional)
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    <strong>Specific product:</strong> Select one or more
                    products in the <strong>Products</strong> section below. The
                    discount applies only when at least one is in the cart.
                  </li>
                  <li>
                    <strong>Product from a category:</strong> Select one or more
                    categories in the <strong>Categories</strong> section below.
                    The discount applies only when the cart has at least one
                    product from one of those categories.
                  </li>
                </ul>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="rulePaymentMethodKey">
                  Payment method restriction
                </label>
                <select
                  className={inputClass}
                  id="rulePaymentMethodKey"
                  onChange={(e) => setRulePaymentMethodKey(e.target.value)}
                  value={rulePaymentMethodKey}
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
              <div
                className={`
                grid gap-4
                sm:grid-cols-2
                md:grid-cols-4
              `}
              >
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleSubtotalMin">
                    Subtotal min ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleSubtotalMin"
                    min={0}
                    onChange={(e) => setRuleSubtotalMin(e.target.value)}
                    placeholder="e.g. 50"
                    step={0.01}
                    type="number"
                    value={ruleSubtotalMin}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleSubtotalMax">
                    Subtotal max ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleSubtotalMax"
                    min={0}
                    onChange={(e) => setRuleSubtotalMax(e.target.value)}
                    placeholder="No max"
                    step={0.01}
                    type="number"
                    value={ruleSubtotalMax}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleShippingMin">
                    Shipping min ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleShippingMin"
                    min={0}
                    onChange={(e) => setRuleShippingMin(e.target.value)}
                    placeholder="No min"
                    step={0.01}
                    type="number"
                    value={ruleShippingMin}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleShippingMax">
                    Shipping max ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleShippingMax"
                    min={0}
                    onChange={(e) => setRuleShippingMax(e.target.value)}
                    placeholder="No max"
                    step={0.01}
                    type="number"
                    value={ruleShippingMax}
                  />
                </div>
              </div>
              <div
                className={`
                grid gap-4
                sm:grid-cols-2
                md:grid-cols-4
              `}
              >
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleProductCountMin">
                    Product count min
                  </label>
                  <input
                    className={inputClass}
                    id="ruleProductCountMin"
                    min={0}
                    onChange={(e) => setRuleProductCountMin(e.target.value)}
                    placeholder="e.g. 2"
                    step={1}
                    type="number"
                    value={ruleProductCountMin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total quantity of items
                  </p>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleProductCountMax">
                    Product count max
                  </label>
                  <input
                    className={inputClass}
                    id="ruleProductCountMax"
                    min={0}
                    onChange={(e) => setRuleProductCountMax(e.target.value)}
                    placeholder="No max"
                    step={1}
                    type="number"
                    value={ruleProductCountMax}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleOrderTotalMin">
                    Order total min ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleOrderTotalMin"
                    min={0}
                    onChange={(e) => setRuleOrderTotalMin(e.target.value)}
                    placeholder="e.g. 75"
                    step={0.01}
                    type="number"
                    value={ruleOrderTotalMin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Subtotal + shipping
                  </p>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="ruleOrderTotalMax">
                    Order total max ($)
                  </label>
                  <input
                    className={inputClass}
                    id="ruleOrderTotalMax"
                    min={0}
                    onChange={(e) => setRuleOrderTotalMax(e.target.value)}
                    placeholder="No max"
                    step={0.01}
                    type="number"
                    value={ruleOrderTotalMax}
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
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="maxUses">
                  Total times the code can be used
                </label>
                <input
                  className={inputClass}
                  id="maxUses"
                  min={1}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="e.g. 1000"
                  type="number"
                  value={maxUses}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="maxUsesPerCustomer">
                  Times per customer (limit)
                </label>
                <input
                  className={inputClass}
                  id="maxUsesPerCustomer"
                  min={1}
                  onChange={(e) => setMaxUsesPerCustomer(e.target.value)}
                  placeholder="Unlimited"
                  type="number"
                  value={maxUsesPerCustomer}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="maxUsesPerCustomerType">
                Per-customer is identified by
              </label>
              <select
                className={inputClass}
                id="maxUsesPerCustomerType"
                onChange={(e) =>
                  setMaxUsesPerCustomerType(
                    e.target.value as
                      | ""
                      | "account"
                      | "phone"
                      | "shipping_address",
                  )
                }
                value={maxUsesPerCustomerType}
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
            <div
              className={`
              grid gap-4
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="tokenHolderChain">
                  Chain
                </label>
                <select
                  className={inputClass}
                  id="tokenHolderChain"
                  onChange={(e) => setTokenHolderChain(e.target.value)}
                  value={tokenHolderChain}
                >
                  <option value="">—</option>
                  <option value="solana">Solana</option>
                  <option value="evm">EVM</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="tokenHolderMinBalance">
                  Min balance
                </label>
                <input
                  className={inputClass}
                  id="tokenHolderMinBalance"
                  onChange={(e) => setTokenHolderMinBalance(e.target.value)}
                  placeholder="e.g. 1000"
                  type="text"
                  value={tokenHolderMinBalance}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="tokenHolderTokenAddress">
                Token mint / contract address
              </label>
              <input
                className={cn(inputClass, "font-mono text-xs")}
                id="tokenHolderTokenAddress"
                onChange={(e) => setTokenHolderTokenAddress(e.target.value)}
                placeholder="Solana mint or ERC20 contract"
                type="text"
                value={tokenHolderTokenAddress}
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
                  <label className="flex items-center gap-2 text-sm" key={c.id}>
                    <input
                      checked={categoryIds.includes(c.id)}
                      className="size-4 rounded border-input"
                      onChange={() => toggleCategory(c.id)}
                      type="checkbox"
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
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={ruleAppliesToEsim}
                className="size-4 rounded border-input"
                onChange={(e) => setRuleAppliesToEsim(e.target.checked)}
                type="checkbox"
              />
              <span>Applies to eSIM products</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When checked, this discount applies to any eSIM in the cart (eSIMs
              are virtual products and do not appear in the list below).
            </p>
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
                      className="flex items-center gap-2 text-sm"
                      key={p.id}
                    >
                      <input
                        checked={productIds.includes(p.id)}
                        className="size-4 rounded border-input"
                        onChange={() => toggleProduct(p.id)}
                        type="checkbox"
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
          <Button disabled={saving} type="submit">
            {saving ? "Creating…" : "Create discount"}
          </Button>
          <Button
            onClick={() => router.push("/coupons")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
