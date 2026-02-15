"use client";

import { useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

interface CryptoPriceProps {
  className?: string;
  usdAmount: number;
}

export function CryptoPrice({ className, usdAmount }: CryptoPriceProps) {
  const [mounted, setMounted] = useState(false);
  const { convertUsdToCrypto, formatCrypto } = useCryptoCurrency();

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

  const cryptoAmount = convertUsdToCrypto(usdAmount);
  if (cryptoAmount == null) return null;
  return (
    <span
      className={cn(
        "font-mono-crypto text-sm text-muted-foreground",
        className,
      )}
      data-crypto-price
    >
      {formatCrypto(cryptoAmount)}
    </span>
  );
}
