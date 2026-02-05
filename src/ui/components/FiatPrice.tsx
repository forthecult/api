"use client";

import { useEffect, useState } from "react";

import { useCountryCurrency } from "~/lib/hooks/use-country-currency";

interface FiatPriceProps {
  usdAmount: number;
  className?: string;
}

export function FiatPrice({ usdAmount, className }: FiatPriceProps) {
  const [mounted, setMounted] = useState(false);
  const { convertUsdToFiat, formatFiat } = useCountryCurrency();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className={className ?? ""}
        data-fiat-price
        aria-hidden
        style={{ minWidth: "4ch" }}
      >
        {"\u00A0"}
      </span>
    );
  }

  const fiatAmount = convertUsdToFiat(usdAmount);
  if (fiatAmount == null) {
    return (
      <span
        className={className ?? ""}
        data-fiat-price
        aria-hidden
        style={{ minWidth: "4ch" }}
      >
        {"\u00A0"}
      </span>
    );
  }

  return (
    <span className={className ?? ""} data-fiat-price>
      {formatFiat(fiatAmount)}
    </span>
  );
}
