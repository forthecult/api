"use client";

import { CircleHelp, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { cn } from "~/lib/cn";
import type { CartItem } from "~/ui/components/cart";

import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";

import type { TierDiscountLine } from "../hooks/useCoupons";

import { type AppliedCoupon, checkoutFieldHeight } from "../checkout-shared";

const placeholderSrc = "/placeholder.svg";

/** Minimal blur placeholder to avoid thumbnail flash while loading. */
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMAAAQ";

function variantDisplayOnly(name: string, variantLabel: string): string {
  if (!variantLabel?.trim()) return name;
  return variantLabel.trim();
}

export interface OrderSummaryProps {
  appliedCoupon: AppliedCoupon | null;
  couponError: string;
  couponLoading: boolean;
  cryptoTotalLabel: null | string;
  customsDutiesNote: null | string;
  discountCodeInput: string;
  itemCount: number;
  items: CartItem[];
  onApplyCoupon: () => void;
  onDiscountCodeInputChange: (value: string) => void;
  onRemoveCoupon: () => void;
  onRemoveItem?: (id: string) => void;
  onShowDiscountCode: () => void;
  /** Cart editing callbacks */
  onUpdateQuantity?: (id: string, quantity: number) => void;
  shippingCents: number;
  shippingFree: boolean;
  shippingLoading: boolean;
  /** Discount code UI (state lives in parent so it can drive API/coupon logic). */
  showDiscountCode: boolean;
  subtotal: number;
  taxCents: number;
  taxNote: null | string;
  /** Member tier discounts (stacked). Shown as "Member savings". */
  tierDiscounts?: TierDiscountLine[];
  tierDiscountTotalCents?: number;
  total: number;
}

export function OrderSummary({
  appliedCoupon,
  couponError,
  couponLoading,
  cryptoTotalLabel,
  customsDutiesNote,
  discountCodeInput,
  itemCount,
  items,
  onApplyCoupon,
  onDiscountCodeInputChange,
  onRemoveCoupon,
  onRemoveItem,
  onShowDiscountCode,
  onUpdateQuantity,
  shippingCents,
  shippingFree,
  shippingLoading,
  showDiscountCode,
  subtotal,
  taxCents,
  tierDiscounts = [],
  tierDiscountTotalCents = 0,
  total,
}: OrderSummaryProps) {
  const [failedImageIds, setFailedImageIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [loadedImageIds, setLoadedImageIds] = React.useState<Set<string>>(
    () => new Set(),
  );

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
            className={`
              flex gap-3 rounded-lg border border-border/60 bg-muted/30 p-3
            `}
            key={item.id}
          >
            <div
              className={`
              relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white
            `}
            >
              {item.image?.trim() && !failedImageIds.has(item.id) && (
                <div
                  aria-hidden
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${BLUR_DATA_URL})` }}
                />
              )}
              <Image
                alt={item.name}
                blurDataURL={
                  item.image?.trim() && !failedImageIds.has(item.id)
                    ? BLUR_DATA_URL
                    : undefined
                }
                className={cn(
                  "object-contain transition-opacity duration-300",
                  item.image?.trim() &&
                    !failedImageIds.has(item.id) &&
                    !loadedImageIds.has(item.id)
                    ? "opacity-0"
                    : "opacity-100",
                )}
                fill
                onError={() =>
                  setFailedImageIds((prev) => new Set(prev).add(item.id))
                }
                onLoad={() =>
                  setLoadedImageIds((prev) => new Set(prev).add(item.id))
                }
                placeholder={
                  item.image?.trim() && !failedImageIds.has(item.id)
                    ? "blur"
                    : "empty"
                }
                sizes="64px"
                src={
                  failedImageIds.has(item.id) || !item.image?.trim()
                    ? placeholderSrc
                    : item.image.trim()
                }
                unoptimized={
                  !item.image?.trim()
                    ? false
                    : /^https?:\/\//i.test(item.image)
                }
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-tight font-medium">{item.name}</p>
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
                <div
                  className={`
                  flex items-center rounded-md border border-border
                `}
                >
                  <button
                    aria-label={`Decrease quantity of ${item.name}`}
                    className={`
                      flex size-6 items-center justify-center rounded-l-md
                      text-muted-foreground transition-colors
                      hover:bg-muted hover:text-foreground
                      disabled:opacity-40
                    `}
                    disabled={item.quantity <= 1}
                    onClick={() =>
                      onUpdateQuantity?.(item.id, item.quantity - 1)
                    }
                    type="button"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span
                    className={`
                    flex w-7 items-center justify-center text-xs font-medium
                    tabular-nums
                  `}
                  >
                    {item.quantity}
                  </span>
                  <button
                    aria-label={`Increase quantity of ${item.name}`}
                    className={`
                      flex size-6 items-center justify-center rounded-r-md
                      text-muted-foreground transition-colors
                      hover:bg-muted hover:text-foreground
                    `}
                    onClick={() =>
                      onUpdateQuantity?.(item.id, item.quantity + 1)
                    }
                    type="button"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <button
                  aria-label={`Remove ${item.name}`}
                  className={`
                    flex size-6 items-center justify-center rounded-md
                    text-muted-foreground transition-colors
                    hover:bg-destructive/10 hover:text-destructive
                  `}
                  onClick={() => onRemoveItem?.(item.id)}
                  type="button"
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
                className={`
                  text-primary underline-offset-4
                  hover:underline
                `}
                onClick={onShowDiscountCode}
                type="button"
              >
                Have a code?
              </button>
            ) : (
              <div className="flex w-full max-w-[65%] flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    aria-label="Discount code"
                    className={`
                      ${checkoutFieldHeight}
                      min-w-0 flex-1
                    `}
                    disabled={couponLoading}
                    onChange={(e) => onDiscountCodeInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onApplyCoupon();
                      }
                    }}
                    placeholder="Discount code or gift card"
                    type="text"
                    value={discountCodeInput}
                  />
                  <Button
                    className={`
                      ${checkoutFieldHeight}
                      shrink-0
                    `}
                    disabled={couponLoading || !discountCodeInput.trim()}
                    onClick={onApplyCoupon}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {couponLoading ? (
                      <Loader2 aria-hidden className="size-4 animate-spin" />
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
                  <FiatPrice usdAmount={appliedCoupon.discountCents / 100} />
                )}
                {appliedCoupon.source === "code" ? (
                  <button
                    className={`
                      text-xs text-primary underline-offset-4
                      hover:underline
                    `}
                    onClick={onRemoveCoupon}
                    type="button"
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
                  aria-label="Shipping information"
                  className={`
                    shrink-0 rounded-full p-0.5 text-muted-foreground
                    hover:bg-muted hover:text-foreground
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:outline-none
                  `}
                  type="button"
                >
                  <CircleHelp aria-hidden className="size-4" />
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Shipping</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div
                      className={`
                      flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2
                      dark:bg-blue-950/30
                    `}
                    >
                      <span
                        className={`
                        font-medium text-blue-700
                        dark:text-blue-400
                      `}
                      >
                        Most orders ship within 1 business day
                      </span>
                    </div>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span
                          className={`
                          mt-1 block size-1.5 shrink-0 rounded-full
                          bg-foreground/40
                        `}
                        />
                        <strong>Domestic (US):</strong> 2–4 business days
                      </li>
                      <li className="flex items-start gap-2">
                        <span
                          className={`
                          mt-1 block size-1.5 shrink-0 rounded-full
                          bg-foreground/40
                        `}
                        />
                        <strong>International:</strong> 5–14 business days
                      </li>
                      <li className="flex items-start gap-2">
                        <span
                          className={`
                          mt-1 block size-1.5 shrink-0 rounded-full
                          bg-foreground/40
                        `}
                        />
                        Tracking number sent via email once shipped
                      </li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Peak seasons may add up to 1 week. P.O. Boxes are not
                      supported.
                    </p>
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
            <p className="text-xs text-muted-foreground">{customsDutiesNote}</p>
          ) : null}
        </div>
        <div
          className={`
          flex justify-between border-t border-border pt-3 text-base
          font-semibold
        `}
        >
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
