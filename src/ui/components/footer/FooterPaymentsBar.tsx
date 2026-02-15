"use client";

import Image from "next/image";

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

export function FooterPaymentsBar() {
  const { visibility } = usePaymentMethodSettings();
  const paymentItems = getFooterPaymentItems(visibility);
  const cryptoItems = paymentItems.filter(
    (item) => !CARD_OR_PAYPAL_NAMES.has(item.name),
  );
  const cardItems = paymentItems.filter((item) =>
    CARD_OR_PAYPAL_NAMES.has(item.name),
  );

  const renderItem = (
    item: { name: string; src: string; title?: string },
    iconWidth: number,
  ) => (
    <li className="shrink-0" key={item.name} role="listitem">
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
          className={`flex flex-wrap items-center justify-center ${logoGap}`}
          role="list"
        >
          {cryptoItems.map((item) => renderItem(item, CRYPTO_ICON_WIDTH))}
        </ul>
      )}
      {cardItems.length > 0 && (
        <ul
          aria-label="Card and wallet payment options"
          className={`flex flex-wrap items-center justify-center ${logoGap}`}
          role="list"
        >
          {cardItems.map((item) => renderItem(item, CARD_ICON_WIDTH))}
        </ul>
      )}
    </div>
  );
}
