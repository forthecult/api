"use client";

import { Minus, Plus, ShoppingBag, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { useCart } from "~/lib/hooks/use-cart";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";

const PLACEHOLDER_SRC = "/placeholder.svg";

export default function TelegramCartPage() {
  const { itemCount, items, removeItem, subtotal, updateQuantity } = useCart();
  const [failedImageIds, setFailedImageIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header
        className={`
          sticky top-0 z-10 border-b border-[var(--tg-theme-hint-color,#999)]/20
          bg-[var(--tg-theme-bg-color,#fff)] px-4 py-3
        `}
      >
        <h1
          className={`
            text-lg font-semibold text-[var(--tg-theme-text-color,#000)]
          `}
        >
          Your Cart
        </h1>
      </header>

      <div className="flex-1 px-4 py-6">
        {itemCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={`
                mb-4 flex h-20 w-20 items-center justify-center rounded-full
                bg-[var(--tg-theme-secondary-bg-color,#eee)]
              `}
            >
              <ShoppingCart
                className={`h-10 w-10 text-[var(--tg-theme-hint-color,#999)]`}
              />
            </div>
            <p
              className={`
                mb-6 text-center text-[var(--tg-theme-text-color,#000)]
              `}
            >
              Your cart is empty.
            </p>
            <Button asChild className="w-full max-w-xs" variant="outline">
              <Link href="/telegram">
                <ShoppingBag className="mr-2 size-4" />
                Continue shopping
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  className={`
                    flex gap-3 rounded-lg border
                    border-[var(--tg-theme-hint-color,#999)]/20
                    bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] p-3
                  `}
                  key={item.id}
                >
                  <div
                    className={`
                      relative h-20 w-20 shrink-0 overflow-hidden rounded
                      bg-white
                    `}
                  >
                    {failedImageIds.has(item.id) || !item.image?.trim() ? (
                      <Image
                        alt={item.name}
                        className="object-contain"
                        fill
                        sizes="80px"
                        src={PLACEHOLDER_SRC}
                      />
                    ) : (
                      <Image
                        alt={item.name}
                        className="object-contain"
                        fill
                        onError={() =>
                          setFailedImageIds((prev) =>
                            new Set(prev).add(item.id),
                          )
                        }
                        sizes="80px"
                        src={item.image.trim()}
                        unoptimized={
                          item.image.startsWith("data:") ||
                          item.image.startsWith("http://")
                        }
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`
                          line-clamp-2 text-sm font-medium
                          text-[var(--tg-theme-text-color,#000)]
                        `}
                      >
                        {item.name}
                      </span>
                      <button
                        aria-label="Remove"
                        className={`
                          shrink-0 rounded p-1
                          text-[var(--tg-theme-hint-color,#999)]
                          hover:bg-black/10
                        `}
                        onClick={() => removeItem(item.id)}
                        type="button"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <p
                      className={`
                        mt-0.5 text-xs text-[var(--tg-theme-hint-color,#999)]
                      `}
                    >
                      {item.category}
                    </p>
                    <div
                      className={`mt-2 flex items-center justify-between gap-2`}
                    >
                      <div
                        className={`
                          flex items-center rounded border
                          border-[var(--tg-theme-hint-color,#999)]/30
                        `}
                      >
                        <button
                          className={`
                            flex h-7 w-7 items-center justify-center
                            disabled:opacity-50
                          `}
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          type="button"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span
                          className={`
                            flex h-7 w-7 items-center justify-center text-xs
                            font-medium
                          `}
                        >
                          {item.quantity}
                        </span>
                        <button
                          className="flex h-7 w-7 items-center justify-center"
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          type="button"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                      <span
                        className={`
                          shrink-0 text-sm font-medium
                          text-[var(--tg-theme-text-color,#000)]
                        `}
                      >
                        <FiatPrice usdAmount={item.price * item.quantity} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`
                mt-8 border-t border-[var(--tg-theme-hint-color,#999)]/20 pt-6
              `}
            >
              <div
                className={`
                  mb-4 flex items-center justify-between
                  text-[var(--tg-theme-text-color,#000)]
                `}
              >
                <span className="text-sm text-[var(--tg-theme-hint-color,#999)]">
                  Subtotal
                </span>
                <span className="font-semibold">
                  <FiatPrice usdAmount={subtotal} />
                </span>
              </div>
              <p className="mb-4 text-xs text-[var(--tg-theme-hint-color,#999)]">
                Shipping calculated at checkout.
              </p>
              <Button asChild className="w-full" size="lg">
                <Link href="/telegram/checkout">Proceed to checkout</Link>
              </Button>
              <Button
                asChild
                className={`
                  mt-3 w-full border-[var(--tg-theme-button-color,#3390ec)]
                  bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]
                  text-[var(--tg-theme-text-color,#000)]
                  hover:bg-[var(--tg-theme-hint-color,#999)]/10
                `}
                variant="outline"
              >
                <Link href="/telegram">Continue shopping</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
