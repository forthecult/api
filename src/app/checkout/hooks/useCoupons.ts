"use client";

import { useCallback, useEffect, useState } from "react";

import type { AppliedCoupon } from "../checkout-shared";

export interface TierDiscountLine {
  discountCents: number;
  id: string;
  label: null | string;
  scope: string;
}

export interface UseCouponsArgs {
  items: {
    id: string;
    /** Unit price in dollars (e.g. 9.99). Used to compute per-product discounts. */
    price: number;
    productId?: string;
    quantity?: number;
  }[];
  /**
   * The selected payment method key (from PAYMENT_METHOD_DEFAULTS).
   * Used to match automatic discounts with a payment method restriction.
   * e.g. "crypto_troll", "crypto_solana", "stripe", etc.
   */
  paymentMethodKey?: null | string;
  shippingCents: number;
  subtotal: number;
  /** Staking wallet (e.g. Solana) for CULT member tier; when set, tier-based discounts are fetched and stacked. */
  wallet?: null | string;
}

export interface UseCouponsResult {
  appliedCoupon: AppliedCoupon | null;
  automaticCouponLoading: boolean;
  couponError: string;
  couponLoading: boolean;
  discountCodeInput: string;
  handleApplyCoupon: () => Promise<void>;
  removeCoupon: () => void;
  setDiscountCodeInput: (value: string) => void;
  setShowDiscountCode: (value: boolean) => void;
  showDiscountCode: boolean;
  /** Member tier discounts (stacked). Empty when no wallet or no tier discounts. */
  tierDiscounts: TierDiscountLine[];
  /** Total cents from tier discounts. */
  tierDiscountTotalCents: number;
}

export function useCoupons({
  items,
  paymentMethodKey,
  shippingCents,
  subtotal,
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
        body: JSON.stringify({
          code,
          items: items.map((i) => ({
            priceCents: Math.round(i.price * 100),
            productId: i.productId ?? i.id,
            quantity: i.quantity ?? 1,
          })),
          paymentMethodKey: paymentMethodKey || undefined,
          productIds: items.map((i) => i.productId ?? i.id),
          shippingFeeCents: Math.round(shippingCents),
          subtotalCents: Math.round(subtotal * 100),
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json()) as
        | {
            code: string;
            couponId: string;
            discountCents: number;
            discountKind: string;
            discountType: string;
            discountValue: number;
            freeShipping: boolean;
            totalAfterDiscountCents: number;
            valid: true;
          }
        | { error?: string; valid: false };
      if (data.valid) {
        setAppliedCoupon({
          code: data.code,
          couponId: data.couponId,
          discountCents: data.discountCents,
          discountKind: data.discountKind,
          discountType: data.discountType,
          discountValue: data.discountValue,
          freeShipping: data.freeShipping,
          source: "code",
          totalAfterDiscountCents: data.totalAfterDiscountCents,
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
      body: JSON.stringify({
        items: items.map((i) => ({
          priceCents: Math.round(i.price * 100),
          productId: i.productId ?? i.id,
          quantity: i.quantity ?? 1,
        })),
        paymentMethodKey: paymentMethodKey || undefined,
        productCount,
        productIds: items.map((i) => i.productId ?? i.id),
        shippingFeeCents: Math.round(shippingCents),
        subtotalCents: Math.round(subtotal * 100),
        wallet: wallet?.trim() || undefined,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((res) => res.json())
      .then((data: Record<string, unknown> & { applied: boolean }) => {
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
            code: data.code as string,
            couponId: data.couponId as string,
            discountCents:
              typeof data.discountCents === "number" ? data.discountCents : 0,
            discountKind: (data.discountKind as string) ?? "amount_off_order",
            discountType: (data.discountType as string) ?? "percent",
            discountValue:
              typeof data.discountValue === "number" ? data.discountValue : 0,
            freeShipping: data.freeShipping === true,
            source: "automatic",
            totalAfterDiscountCents:
              typeof data.totalAfterDiscountCents === "number"
                ? data.totalAfterDiscountCents
                : 0,
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
    automaticCouponLoading,
    couponError,
    couponLoading,
    discountCodeInput,
    handleApplyCoupon,
    removeCoupon,
    setDiscountCodeInput: setDiscountCodeInputWithClearError,
    setShowDiscountCode,
    showDiscountCode,
    tierDiscounts,
    tierDiscountTotalCents,
  };
}
