"use client";

import Image from "next/image";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

/** How much of the doge is visible above the bar (px) */
const PEEK_HEIGHT = 55;
/** Rendered width of the doge image (px) */
const IMAGE_WIDTH = 120;

export function FooterDogePeek() {
  const { selectedCrypto } = useCryptoCurrency();
  if (selectedCrypto !== "DOGE") return null;

  return (
    <div
      className="pointer-events-none absolute right-6 overflow-hidden sm:right-10 lg:right-16"
      aria-hidden
      style={{
        bottom: "100%",
        height: PEEK_HEIGHT,
        width: IMAGE_WIDTH,
      }}
    >
      <div
        className="doge-peek-bob absolute bottom-0"
        style={{ width: IMAGE_WIDTH }}
      >
        <Image
          alt=""
          height={869}
          role="presentation"
          src="/images/doge-peek.png"
          unoptimized
          width={1000}
          style={{
            width: IMAGE_WIDTH,
            height: "auto",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
