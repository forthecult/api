"use client";

import Image from "next/image";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

/** How much of the doge head is visible above the bar (px) */
const PEEK_HEIGHT = 110;
/** Rendered width of the doge image (px) */
const IMAGE_WIDTH = 240;

export function FooterDogePeek() {
  const { selectedCrypto } = useCryptoCurrency();
  if (selectedCrypto !== "DOGE") return null;

  return (
    <div
      className="doge-peek-bob pointer-events-none absolute right-6 overflow-hidden sm:right-10 lg:right-16"
      aria-hidden
      style={{
        bottom: "100%",
        height: PEEK_HEIGHT,
        width: IMAGE_WIDTH,
      }}
    >
      {/* Image is placed normally so the top (head/ears) shows first.
          The container clips whatever extends past PEEK_HEIGHT — hiding the body below the bar. */}
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
  );
}
