"use client";

import Image from "next/image";

import { getFooterPaymentItems } from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

// SVGs are 38×24 with card chrome built in (or scaled to match)
const ICON_WIDTH = 38;
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

  const renderItem = (item: { name: string; src: string; title?: string }) => (
    <li className="shrink-0" key={item.name} role="listitem">
      <span
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: ICON_HEIGHT,
          minHeight: ICON_HEIGHT,
          minWidth: ICON_WIDTH,
          width: ICON_WIDTH,
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
          width={ICON_WIDTH}
        />
      </span>
    </li>
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="sr-only">Payment methods</span>
      {cryptoItems.length > 0 && (
        <ul
          aria-label="Crypto payment options"
          className="flex flex-wrap items-center justify-center gap-1.5"
          role="list"
        >
          {cryptoItems.map(renderItem)}
        </ul>
      )}
      {cardItems.length > 0 && (
        <ul
          aria-label="Card and wallet payment options"
          className="flex flex-wrap items-center justify-center gap-2"
          role="list"
        >
          {cardItems.map(renderItem)}
        </ul>
      )}
    </div>
  );
}
