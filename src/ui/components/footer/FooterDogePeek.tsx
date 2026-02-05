"use client";

import Image from "next/image";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

const PEEK_HEIGHT = 44;
const PEEK_WIDTH = 80;

export function FooterDogePeek() {
  const { selectedCrypto } = useCryptoCurrency();
  if (selectedCrypto !== "DOGE") return null;

  return (
    <div
      className="pointer-events-none absolute right-0 flex justify-end overflow-hidden"
      aria-hidden
      style={{
        bottom: "100%",
        height: PEEK_HEIGHT,
        width: PEEK_WIDTH,
      }}
    >
      <div
        className="doge-peek-bob absolute bottom-0"
        style={{ height: PEEK_HEIGHT * 2, width: PEEK_WIDTH * 2, left: "50%" }}
      >
        <Image
          alt=""
          className="object-cover object-top"
          height={PEEK_HEIGHT * 3}
          role="presentation"
          src="/images/doge-peek.png"
          unoptimized
          width={PEEK_WIDTH * 3}
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
}
