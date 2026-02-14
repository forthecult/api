"use client";

import Image from "next/image";
import { CircleHelp, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";
import { FiatPrice } from "~/ui/components/FiatPrice";
import {
  checkoutFieldHeight,
  type AppliedCoupon,
} from "../checkout-shared";
import type { TierDiscountLine } from "../hooks/useCoupons";
import type { CartItem } from "~/ui/components/cart";

/** Show only the variant (e.g. "2XL") when variantLabel repeats the product name. */
function variantDisplayOnly(productName: string, variantLabel: string): string {
  if (!variantLabel?.trim()) return variantLabel ?? "";
  const name = (productName ?? "").trim();
  if (!name || !variantLabel.startsWith(name)) return variantLabel;
  const rest = variantLabel.slice(name.length).replace(/^\s*\/\s*/, "").trim();
  return rest || variantLabel;
}

export interface OrderSummaryProps {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shippingCents: number;
  shippingLoading: boolean;
  shippingFree: boolean;
  taxCents: number;
  taxNote: string | null;
  customsDutiesNote: string | null;
  appliedCoupon: AppliedCoupon | null;
  /** Member tier discounts (stacked). Shown as "Member savings". */
  tierDiscounts?: TierDiscountLine[];
  tierDiscountTotalCents?: number;
  total: number;
  cryptoTotalLabel: string | null;
  /** Discount code UI (state lives in parent so it can drive API/coupon logic). */
  showDiscountCode: boolean;
  discountCodeInput: string;
  couponError: string;
  couponLoading: boolean;
  onShowDiscountCode: () => void;
  onDiscountCodeInputChange: (value: string) => void;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
  /** Cart editing callbacks */
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
}

export function OrderSummary({
  items,
  itemCount,
  subtotal,
  shippingCents,
  shippingLoading,
  shippingFree,
  taxCents,
  customsDutiesNote,
  appliedCoupon,
  tierDiscounts = [],
  tierDiscountTotalCents = 0,
  total,
  cryptoTotalLabel,
  showDiscountCode,
  discountCodeInput,
  couponError,
  couponLoading,
  onShowDiscountCode,
  onDiscountCodeInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  onUpdateQuantity,
  onRemoveItem,
}: OrderSummaryProps) {
  const [failedImageIds, setFailedImageIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const placeholderSrc = "/placeholder.svg";

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Your order</CardTitle>
        <CardDescription>
          {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            className="flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
            key={item.id}
          >
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white">
              {failedImageIds.has(item.id) || !(item.image?.trim()) ? (
                <Image
                  alt={item.name}
                  className="object-contain"
                  fill
                  sizes="64px"
                  src={placeholderSrc}
                />
              ) : (
                <Image
                  alt={item.name}
                  className="object-contain"
                  fill
                  sizes="64px"
                  src={item.image.trim()}
                  unoptimized={/^https?:\/\//i.test(item.image)}
                  onError={() =>
                    setFailedImageIds((prev) => new Set(prev).add(item.id))
                  }
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{item.name}</p>
              {item.variantLabel ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {variantDisplayOnly(item.name, item.variantLabel)}
                </p>
              ) : null}
              <p className="mt-0.5 text-sm text-muted-foreground">
                <FiatPrice usdAmount={item.price} /> each
              </p>
              {/* Quantity controls */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex items-center rounded-md border border-border">
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                    aria-label={`Decrease quantity of ${item.name}`}
                    disabled={item.quantity <= 1}
                    onClick={() => onUpdateQuantity?.(item.id, item.quantity - 1)}
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="flex w-7 items-center justify-center text-xs font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Increase quantity of ${item.name}`}
                    onClick={() => onUpdateQuantity?.(item.id, item.quantity + 1)}
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemoveItem?.(item.id)}
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
            <p className="shrink-0 text-sm font-medium">
              <FiatPrice usdAmount={item.price * item.quantity} />
            </p>
          </div>
        ))}
        <div className="space-y-2 border-t border-border pt-3 text-sm">
          <div className="space-y-2">
            {!showDiscountCode ? (
              <button
                type="button"
                onClick={onShowDiscountCode}
                className="text-primary underline-offset-4 hover:underline"
              >
                Have a code?
              </button>
            ) : (
              <div className="flex w-full max-w-[65%] flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Discount code or gift card"
                    value={discountCodeInput}
                    onChange={(e) => onDiscountCodeInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onApplyCoupon();
                      }
                    }}
                    className={`${checkoutFieldHeight} min-w-0 flex-1`}
                    disabled={couponLoading}
                    aria-label="Discount code"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className={`${checkoutFieldHeight} shrink-0`}
                    onClick={onApplyCoupon}
                    disabled={couponLoading || !discountCodeInput.trim()}
                  >
                    {couponLoading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>
                {couponError ? (
                  <p className="text-xs text-destructive">{couponError}</p>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">
              <FiatPrice usdAmount={subtotal} />
            </span>
          </div>
          {appliedCoupon ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Discount
                {appliedCoupon.source === "automatic" ? (
                  <span className="ml-1 font-normal text-muted-foreground/80">
                    (automatic)
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 font-medium">
                {appliedCoupon.freeShipping ? (
                  "Free shipping"
                ) : (
                  <FiatPrice
                    usdAmount={appliedCoupon.discountCents / 100}
                  />
                )}
                {appliedCoupon.source === "code" ? (
                  <button
                    type="button"
                    onClick={onRemoveCoupon}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </div>
          ) : null}
          {tierDiscountTotalCents > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member savings</span>
              <span className="font-medium">
                -<FiatPrice usdAmount={tierDiscountTotalCents / 100} />
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              Shipping
              <Dialog>
                <DialogTrigger
                  type="button"
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Shipping information"
                >
                  <CircleHelp className="size-4" aria-hidden />
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Shipping</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
                      <span className="font-medium text-blue-700 dark:text-blue-400">Most orders ship within 1 business day</span>
                    </div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2"><span className="mt-1 block size-1.5 shrink-0 rounded-full bg-foreground/40" /><strong>Domestic (US):</strong> 2–4 business days</li>
                      <li className="flex items-start gap-2"><span className="mt-1 block size-1.5 shrink-0 rounded-full bg-foreground/40" /><strong>International:</strong> 5–14 business days</li>
                      <li className="flex items-start gap-2"><span className="mt-1 block size-1.5 shrink-0 rounded-full bg-foreground/40" />Tracking number sent via email once shipped</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">Peak seasons may add up to 1 week. P.O. Boxes are not supported.</p>
                  </div>
                </DialogContent>
              </Dialog>
            </span>
            <span className="font-medium">
              {shippingLoading ? (
                "…"
              ) : shippingFree ? (
                "Free"
              ) : (
                <FiatPrice usdAmount={shippingCents / 100} />
              )}
            </span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex w-full justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">
                <FiatPrice usdAmount={taxCents / 100} />
              </span>
            </div>
          </div>
          {customsDutiesNote ? (
            <p className="text-xs text-muted-foreground">
              {customsDutiesNote}
            </p>
          ) : null}
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
          <span>Total</span>
          <span>
            <FiatPrice usdAmount={total} />
          </span>
        </div>
        {cryptoTotalLabel ? (
          <p className="text-right text-sm text-muted-foreground">
            {cryptoTotalLabel}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
