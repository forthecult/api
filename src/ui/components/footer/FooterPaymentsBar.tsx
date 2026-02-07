"use client";

import Image from "next/image";

import { getFooterPaymentItems } from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

// SVGs are 38×24 with card chrome built in (or scaled to match)
const ICON_WIDTH = 38;
const ICON_HEIGHT = 24;

export function FooterPaymentsBar() {
  const { visibility } = usePaymentMethodSettings();
  const paymentItems = getFooterPaymentItems(visibility);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="sr-only">Payment methods</span>
      <ul
        className="flex flex-wrap items-center justify-center gap-2"
        role="list"
      >
        {paymentItems.map((item) => (
          <li key={item.name} className="shrink-0" role="listitem">
            <span
              className="flex items-center justify-center overflow-hidden"
              style={{
                width: ICON_WIDTH,
                height: ICON_HEIGHT,
                minWidth: ICON_WIDTH,
                minHeight: ICON_HEIGHT,
              }}
            >
              <Image
                alt={item.name}
                height={ICON_HEIGHT}
                role="img"
                src={item.src}
                title={item.title ?? item.name}
                unoptimized
                width={ICON_WIDTH}
                className="block max-h-full max-w-full object-contain object-center"
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
