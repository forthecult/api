"use client";

import Image from "next/image";
import { useState } from "react";

import {
  getPaymentIconPaths,
  type PaymentIconItem,
} from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

const SOLANA_ECOSYSTEM_ALTS = new Set([
  "Solana",
  "CRUST",
  "Pump",
  "Troll",
  "Seeker (SKR)",
]);

interface SecureCheckoutLineProps {
  /** Handling (fulfillment) days max from product. Default: 2 */
  handlingDaysMax?: null | number;
  /** Handling (fulfillment) days min from product. Default: 1 */
  handlingDaysMin?: null | number;
}

export function SecureCheckoutLine({
  handlingDaysMax,
  handlingDaysMin,
}: SecureCheckoutLineProps) {
  const [solanaHover, setSolanaHover] = useState(false);
  const { visibility } = usePaymentMethodSettings();
  const icons = getPaymentIconPaths(visibility);

  // Default to 1-2 days if not specified (most POD products)
  const minDays = handlingDaysMin ?? handlingDaysMax ?? 1;
  const maxDays = handlingDaysMax ?? handlingDaysMin ?? 2;
  const shippingText = formatShippingDays(
    Math.max(1, minDays),
    Math.max(minDays, maxDays),
  );

  const cryptoIcons = icons.filter((i) => i.type === "crypto");
  const cardIcons = icons.filter((i) => i.type === "card");
  const solanaItem = cryptoIcons.find((i) => i.alt === "Solana");
  const otherSolanaEcosystem = cryptoIcons.filter(
    (i) => SOLANA_ECOSYSTEM_ALTS.has(i.alt) && i.alt !== "Solana",
  );
  const otherCryptoIcons = cryptoIcons.filter(
    (i) => !SOLANA_ECOSYSTEM_ALTS.has(i.alt),
  );
  const showSolanaExpand = Boolean(
    solanaItem && otherSolanaEcosystem.length > 0,
  );

  const renderIcon = (
    icon: PaymentIconItem,
    key: string,
  ) => {
    const isCard = icon.type === "card";
    return (
      <span
        className={`
          relative flex shrink-0 items-center justify-center
          ${isCard ? `h-7 w-9` : `h-5 w-6`}
        `}
        key={key}
        title={icon.alt}
      >
        <Image
          alt={icon.alt}
          className="object-contain"
          height={isCard ? 28 : 20}
          src={icon.src}
          unoptimized={icon.src.endsWith(".svg")}
          width={isCard ? 36 : 24}
        />
      </span>
    );
  };

  return (
    <div className="mb-6 block w-full">
      {/* Aligned with Add to Cart button: offset by quantity controls width (approx 7rem) on sm+ screens */}
      <div
        aria-label="Purchase assurances"
        className={`
          flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-base
          text-muted-foreground
          sm:gap-x-3 sm:pl-28
        `}
        role="list"
      >
        <span role="listitem">🔒 Secure Checkout</span>
        <span aria-hidden className="text-muted-foreground/50 select-none">
          |
        </span>
        <span role="listitem">↩️ 30-Day Returns</span>
        <span aria-hidden className="text-muted-foreground/50 select-none">
          |
        </span>
        <span role="listitem">🚚 {shippingText}</span>
      </div>
      {icons.length > 0 && (
        <div
          className={`
            mt-2 flex flex-wrap items-center justify-center gap-2
            sm:pl-28
          `}
        >
          {cryptoIcons.length > 0 && (
            <div
              aria-label="Crypto payment options"
              className="flex flex-wrap items-center gap-1.5"
              role="list"
            >
              {otherCryptoIcons.map((icon, i) =>
                renderIcon(icon, `crypto-other-${i}-${icon.src}`),
              )}
              {showSolanaExpand && solanaItem && (
                <span
                  className="flex items-center gap-1.5"
                  onMouseEnter={() => setSolanaHover(true)}
                  onMouseLeave={() => setSolanaHover(false)}
                >
                  {renderIcon(solanaItem, "crypto-solana")}
                  {solanaHover &&
                    otherSolanaEcosystem.map((icon, i) =>
                      renderIcon(icon, `crypto-solana-ecosystem-${i}-${icon.src}`),
                    )}
                </span>
              )}
              {!showSolanaExpand &&
                cryptoIcons
                  .filter((i) => SOLANA_ECOSYSTEM_ALTS.has(i.alt))
                  .map((icon, i) =>
                    renderIcon(icon, `crypto-${i}-${icon.src}`),
                  )}
            </div>
          )}
          {cardIcons.length > 0 && (
            <div
              aria-label="Card payment options"
              className="flex items-center gap-2"
              role="list"
            >
              {cardIcons.map((icon, i) =>
                renderIcon(icon, `card-${i}-${icon.src}`),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
