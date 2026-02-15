"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppliedCoupon } from "../checkout-shared";

export interface TierDiscountLine {
  id: string;
  label: string | null;
  scope: string;
  discountCents: number;
}

export interface UseCouponsArgs {
  subtotal: number;
  shippingCents: number;
  items: Array<{
    productId?: string;
    id: string;
    quantity?: number;
    /** Unit price in dollars (e.g. 9.99). Used to compute per-product discounts. */
    price: number;
  }>;
  /**
   * The selected payment method key (from PAYMENT_METHOD_DEFAULTS).
   * Used to match automatic discounts with a payment method restriction.
   * e.g. "crypto_troll", "crypto_solana", "stripe", etc.
   */
  paymentMethodKey?: string | null;
  /** Staking wallet (e.g. Solana) for CULT member tier; when set, tier-based discounts are fetched and stacked. */
  wallet?: string | null;
}

export interface UseCouponsResult {
  appliedCoupon: AppliedCoupon | null;
  /** Member tier discounts (stacked). Empty when no wallet or no tier discounts. */
  tierDiscounts: TierDiscountLine[];
  /** Total cents from tier discounts. */
  tierDiscountTotalCents: number;
  discountCodeInput: string;
  setDiscountCodeInput: (value: string) => void;
  couponError: string;
  couponLoading: boolean;
  showDiscountCode: boolean;
  setShowDiscountCode: (value: boolean) => void;
  automaticCouponLoading: boolean;
  handleApplyCoupon: () => Promise<void>;
  removeCoupon: () => void;
}

export function useCoupons({
  subtotal,
  shippingCents,
  items,
  paymentMethodKey,
  wallet,
}: UseCouponsArgs): UseCouponsResult {
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [tierDiscounts, setTierDiscounts] = useState<TierDiscountLine[]>([]);
  const [tierDiscountTotalCents, setTierDiscountTotalCents] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showDiscountCode, setShowDiscountCode] = useState(false);
  const [automaticCouponLoading, setAutomaticCouponLoading] = useState(false);
  const [discountEvalKey, setDiscountEvalKey] = useState(0);

  const handleApplyCoupon = useCallback(async () => {
    const code = discountCodeInput.trim();
    if (!code) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/checkout/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          subtotalCents: Math.round(subtotal * 100),
          shippingFeeCents: Math.round(shippingCents),
          productIds: items.map((i) => i.productId ?? i.id),
          paymentMethodKey: paymentMethodKey || undefined,
          items: items.map((i) => ({
            productId: i.productId ?? i.id,
            priceCents: Math.round(i.price * 100),
            quantity: i.quantity ?? 1,
          })),
        }),
      });
      const data = (await res.json()) as
        | {
            valid: true;
            couponId: string;
            code: string;
            discountKind: string;
            discountType: string;
            discountValue: number;
            discountCents: number;
            freeShipping: boolean;
            totalAfterDiscountCents: number;
          }
        | { valid: false; error?: string };
      if (data.valid) {
        setAppliedCoupon({
          couponId: data.couponId,
          code: data.code,
          discountKind: data.discountKind,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountCents: data.discountCents,
          freeShipping: data.freeShipping,
          totalAfterDiscountCents: data.totalAfterDiscountCents,
          source: "code",
        });
        setDiscountCodeInput("");
        setTierDiscounts([]);
        setTierDiscountTotalCents(0);
      } else {
        setCouponError(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "This discount code is invalid or expired.",
        );
      }
    } catch {
      setCouponError("Could not validate discount code. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  }, [discountCodeInput, subtotal, shippingCents, items, paymentMethodKey]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError("");
    setTierDiscounts([]);
    setTierDiscountTotalCents(0);
    setDiscountEvalKey((k) => k + 1);
  }, []);

  const setDiscountCodeInputWithClearError = useCallback((value: string) => {
    setDiscountCodeInput(value);
    setCouponError("");
  }, []);

  // Fetch and apply best automatic discount + tier discounts when no code has been applied
  useEffect(() => {
    if (appliedCoupon?.source === "code") return;
    if (items.length === 0) {
      setAppliedCoupon(null);
      setTierDiscounts([]);
      setTierDiscountTotalCents(0);
      return;
    }
    let cancelled = false;
    setAutomaticCouponLoading(true);
    const productCount = items.reduce((sum, i) => sum + (i.quantity ?? 1), 0);
    fetch("/api/checkout/coupons/automatic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        subtotalCents: Math.round(subtotal * 100),
        shippingFeeCents: Math.round(shippingCents),
        productCount,
        productIds: items.map((i) => i.productId ?? i.id),
        paymentMethodKey: paymentMethodKey || undefined,
        wallet: wallet?.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId ?? i.id,
          priceCents: Math.round(i.price * 100),
          quantity: i.quantity ?? 1,
        })),
      }),
    })
      .then((res) => res.json())
      .then((data: { applied: boolean } & Record<string, unknown>) => {
        if (cancelled) return;
        const tierList = Array.isArray(data.tierDiscounts)
          ? (data.tierDiscounts as TierDiscountLine[])
          : [];
        const tierTotal =
          typeof data.tierDiscountTotalCents === "number"
            ? data.tierDiscountTotalCents
            : 0;
        setTierDiscounts(tierList);
        setTierDiscountTotalCents(tierTotal);
        if (data.applied && data.couponId != null && data.code != null) {
          setAppliedCoupon({
            couponId: data.couponId as string,
            code: data.code as string,
            discountKind: (data.discountKind as string) ?? "amount_off_order",
            discountType: (data.discountType as string) ?? "percent",
            discountValue:
              typeof data.discountValue === "number" ? data.discountValue : 0,
            discountCents:
              typeof data.discountCents === "number" ? data.discountCents : 0,
            freeShipping: data.freeShipping === true,
            totalAfterDiscountCents:
              typeof data.totalAfterDiscountCents === "number"
                ? data.totalAfterDiscountCents
                : 0,
            source: "automatic",
          });
        } else {
          setAppliedCoupon(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppliedCoupon(null);
          setTierDiscounts([]);
          setTierDiscountTotalCents(0);
        }
      })
      .finally(() => {
        if (!cancelled) setAutomaticCouponLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    items,
    subtotal,
    shippingCents,
    paymentMethodKey,
    wallet,
    discountEvalKey,
  ]);

  return {
    appliedCoupon,
    tierDiscounts,
    tierDiscountTotalCents,
    discountCodeInput,
    setDiscountCodeInput: setDiscountCodeInputWithClearError,
    couponError,
    couponLoading,
    showDiscountCode,
    setShowDiscountCode,
    automaticCouponLoading,
    handleApplyCoupon,
    removeCoupon,
  };
}
