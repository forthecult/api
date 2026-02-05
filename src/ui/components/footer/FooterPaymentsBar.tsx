"use client";

import Image from "next/image";

// your SVGs are 38×24 with card chrome built in
const ICON_WIDTH = 38;
const ICON_HEIGHT = 24;

const PAYMENT_ITEMS: Array<{ name: string; title?: string; src: string }> = [
  { name: "Bitcoin", src: "/payments/bitcoin.svg" },
  {
    name: "Dogecoin",
    title: "Much wow. Such spend.",
    src: "/payments/doge.svg",
  },
  { name: "Monero", src: "/payments/monero.svg" },
  { name: "Ethereum", src: "/payments/ethereum.svg" },
  { name: "Solana", src: "/payments/solana.svg" },
  { name: "American Express", src: "/payments/amex.svg" },
  { name: "Apple Pay", src: "/payments/apple-pay.svg" },
  { name: "Diners Club", src: "/payments/diners.svg" },
  { name: "Discover", src: "/payments/discover.svg" },
  { name: "Google Pay", src: "/payments/google-pay.svg" },
  { name: "Mastercard", src: "/payments/mastercard.svg" },
  { name: "Visa", src: "/payments/visa.svg" },
];

export function FooterPaymentsBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="sr-only">Payment methods</span>
      <ul
        className="flex flex-wrap items-center justify-center gap-2"
        role="list"
      >
        {PAYMENT_ITEMS.map((item) => (
          <li key={item.name} className="shrink-0" role="listitem">
            <Image
              alt={item.name}
              height={ICON_HEIGHT}
              role="img"
              src={item.src}
              title={item.title ?? item.name}
              unoptimized
              width={ICON_WIDTH}
              className="block"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
