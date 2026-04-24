"use client";

import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import {
  type CryptoCode,
  useCryptoCurrency,
} from "~/lib/hooks/use-crypto-currency";

interface CryptoPriceProps {
  className?: string;
  usdAmount: number;
}

export function CryptoPrice({ className, usdAmount }: CryptoPriceProps) {
  const [mounted, setMounted] = useState(false);
  const { convertUsdToCryptoFor, formatCryptoFor, pricingCryptoCodes } =
    useCryptoCurrency();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        aria-hidden
        className={cn(
          "font-mono-crypto text-sm text-muted-foreground",
          className,
        )}
        data-crypto-price
        style={{ minWidth: "8ch" }}
      >
        {"\u00A0"}
      </span>
    );
  }

  const lineRows: { code: CryptoCode; line: string }[] = [];
  for (const code of pricingCryptoCodes) {
    const a = convertUsdToCryptoFor(usdAmount, code);
    if (a == null) continue;
    lineRows.push({ code, line: formatCryptoFor(a, code) });
  }
  if (lineRows.length === 0) return null;
  if (lineRows.length === 1) {
    return (
      <span
        className={cn(
          "font-mono-crypto text-sm text-muted-foreground",
          className,
        )}
        data-crypto-price
      >
        {lineRows[0]!.line}
      </span>
    );
  }
  return (
    <span
      className={cn("flex flex-col gap-0.5 font-mono-crypto", className)}
      data-crypto-price
    >
      {lineRows.map(({ code, line }) => (
        <span className="text-sm text-muted-foreground" key={code}>
          {line}
        </span>
      ))}
    </span>
  );
}
