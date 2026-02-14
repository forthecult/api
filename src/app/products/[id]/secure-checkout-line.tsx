"use client";

import Image from "next/image";

import { getPaymentIconPaths } from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

interface SecureCheckoutLineProps {
  /** Handling (fulfillment) days min from product. Default: 1 */
  handlingDaysMin?: number | null;
  /** Handling (fulfillment) days max from product. Default: 2 */
  handlingDaysMax?: number | null;
}

/**
 * Format shipping days range for display.
 * - Same min/max: "Ships in 1 Day" or "Ships in 2 Days"
 * - Different: "Ships in 1-2 Days"
 */
function formatShippingDays(min: number, max: number): string {
  if (min === max) {
    return `Ships in ${min} ${min === 1 ? "Day" : "Days"}`;
  }
  return `Ships in ${min}-${max} Days`;
}

export function SecureCheckoutLine({
  handlingDaysMin,
  handlingDaysMax,
}: SecureCheckoutLineProps) {
  const { visibility } = usePaymentMethodSettings();
  const icons = getPaymentIconPaths(visibility);

  // Default to 1-2 days if not specified (most POD products)
  const minDays = handlingDaysMin ?? handlingDaysMax ?? 1;
  const maxDays = handlingDaysMax ?? handlingDaysMin ?? 2;
  const shippingText = formatShippingDays(
    Math.max(1, minDays),
    Math.max(minDays, maxDays),
  );

  return (
    <div className="mb-6 block w-full">
      {/* Aligned with Add to Cart button: offset by quantity controls width (approx 7rem) on sm+ screens */}
      <div
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base text-muted-foreground sm:gap-x-3 sm:pl-28"
        role="list"
        aria-label="Purchase assurances"
      >
        <span role="listitem">🔒 Secure Checkout</span>
        <span aria-hidden className="select-none text-muted-foreground/50">
          |
        </span>
        <span role="listitem">↩️ 30-Day Returns</span>
        <span aria-hidden className="select-none text-muted-foreground/50">
          |
        </span>
        <span role="listitem">🚚 {shippingText}</span>
      </div>
      {icons.length > 0 && (() => {
        const cryptoIcons = icons.filter((i) => i.type === "crypto");
        const cardIcons = icons.filter((i) => i.type === "card");
        const renderIcon = (
          { src, alt, type }: { src: string; alt: string; type: string },
          key: string,
        ) => {
          const isCard = type === "card";
          return (
            <span
              key={key}
              className={`relative flex shrink-0 items-center justify-center ${isCard ? "h-7 w-9" : "h-5 w-6"}`}
              title={alt}
            >
              <Image
                alt={alt}
                className="object-contain"
                height={isCard ? 28 : 20}
                src={src}
                width={isCard ? 36 : 24}
                unoptimized={src.endsWith(".svg")}
              />
            </span>
          );
        };
        return (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:pl-28">
            {cryptoIcons.length > 0 && (
              <div className="flex items-center gap-1.5" role="list" aria-label="Crypto payment options">
                {cryptoIcons.map((icon, i) => renderIcon(icon, `crypto-${i}-${icon.src}`))}
              </div>
            )}
            {cardIcons.length > 0 && (
              <div className="flex items-center gap-2" role="list" aria-label="Card payment options">
                {cardIcons.map((icon, i) => renderIcon(icon, `card-${i}-${icon.src}`))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
