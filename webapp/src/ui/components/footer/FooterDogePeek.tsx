"use client";

import Image from "next/image";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

/** How much of the doge head is visible above the bar (px) */
const PEEK_HEIGHT = 138;
/** Rendered width of the doge image (px) */
const IMAGE_WIDTH = 300;

export function FooterDogePeek() {
  const { selectedCrypto } = useCryptoCurrency();
  if (selectedCrypto !== "DOGE") return null;

  return (
    <div
      aria-hidden
      className={`
        pointer-events-none absolute right-6 overflow-hidden
        sm:right-10
        lg:right-16
      `}
      style={{
        bottom: "100%",
        height: PEEK_HEIGHT,
        width: IMAGE_WIDTH,
      }}
    >
      {/* Container is fixed at the bar. The image bobs up/down INSIDE it,
          so the bar always clips the bottom — doge peeks more/less without
          ever lifting off the line. */}
      <Image
        alt=""
        className="doge-peek-bob"
        height={869}
        role="presentation"
        src="/images/doge-peek.png"
        style={{
          display: "block",
          height: "auto",
          width: IMAGE_WIDTH,
        }}
        unoptimized
        width={1000}
      />
    </div>
  );
}
