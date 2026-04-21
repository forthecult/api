"use client";

import Image from "next/image";
import { useState } from "react";

import { getFooterPaymentItems } from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

// Card SVGs are 38×24 with chrome built in; crypto marks are smaller so use narrower cells for tighter visual spacing
const CARD_ICON_WIDTH = 38;
const CRYPTO_ICON_WIDTH = 26;
const ICON_HEIGHT = 24;

const CARD_OR_PAYPAL_NAMES = new Set([
  "American Express",
  "Apple Pay",
  "Diners Club",
  "Discover",
  "Google Pay",
  "Mastercard",
  "PayPal",
  "Visa",
]);

const SOLANA_ECOSYSTEM_NAMES = new Set([
  "Crustafarian",
  "Pump",
  "Seeker (SKR)",
  "Solana",
  "Troll",
]);

export function FooterPaymentsBar() {
  const [solanaHover, setSolanaHover] = useState(false);
  const { visibility } = usePaymentMethodSettings();
  const paymentItems = getFooterPaymentItems(visibility);
  const cryptoItems = paymentItems.filter(
    (item) => !CARD_OR_PAYPAL_NAMES.has(item.name),
  );
  const cardItems = paymentItems.filter((item) =>
    CARD_OR_PAYPAL_NAMES.has(item.name),
  );

  const solanaItem = cryptoItems.find((i) => i.name === "Solana");
  const otherSolanaEcosystem = cryptoItems.filter(
    (i) => SOLANA_ECOSYSTEM_NAMES.has(i.name) && i.name !== "Solana",
  );
  const otherCryptoItems = cryptoItems.filter(
    (i) => !SOLANA_ECOSYSTEM_NAMES.has(i.name),
  );
  const showSolanaExpand = Boolean(
    solanaItem && otherSolanaEcosystem.length > 0,
  );

  const renderItem = (
    item: { name: string; src: string; title?: string },
    iconWidth: number,
  ) => (
    <li className="shrink-0" key={item.name}>
      <span
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: ICON_HEIGHT,
          minHeight: ICON_HEIGHT,
          minWidth: iconWidth,
          width: iconWidth,
        }}
      >
        <Image
          alt={item.name}
          className="block max-h-full max-w-full object-contain object-center"
          height={ICON_HEIGHT}
          role="img"
          src={item.src}
          title={item.title ?? item.name}
          unoptimized
          width={iconWidth}
        />
      </span>
    </li>
  );

  const logoGap = "gap-1.5";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="sr-only">Payment methods</span>
      {cryptoItems.length > 0 && (
        <ul
          aria-label="Crypto payment options"
          className={`
            flex flex-wrap items-center justify-center
            ${logoGap}
          `}
        >
          {otherCryptoItems.map((item) => renderItem(item, CRYPTO_ICON_WIDTH))}
          {showSolanaExpand && solanaItem && (
            <li
              className="flex shrink-0 items-center"
              onMouseEnter={() => setSolanaHover(true)}
              onMouseLeave={() => setSolanaHover(false)}
            >
              <ul
                aria-label="Solana ecosystem"
                className={`
                  flex flex-wrap items-center
                  ${logoGap}
                `}
              >
                {renderItem(solanaItem, CRYPTO_ICON_WIDTH)}
                {solanaHover &&
                  otherSolanaEcosystem.map((item) =>
                    renderItem(item, CRYPTO_ICON_WIDTH),
                  )}
              </ul>
            </li>
          )}
          {!showSolanaExpand &&
            cryptoItems
              .filter((i) => SOLANA_ECOSYSTEM_NAMES.has(i.name))
              .map((item) => renderItem(item, CRYPTO_ICON_WIDTH))}
        </ul>
      )}
      {cardItems.length > 0 && (
        <ul
          aria-label="Card and wallet payment options"
          className={`
            flex flex-wrap items-center justify-center
            ${logoGap}
          `}
        >
          {cardItems.map((item) => renderItem(item, CARD_ICON_WIDTH))}
        </ul>
      )}
    </div>
  );
}
