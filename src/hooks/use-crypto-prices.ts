"use client";

import { useEffect, useState } from "react";

const SOL_USD_FALLBACK = 200;

/**
 * Fetches crypto prices from the server-cached `/api/crypto/prices`
 * endpoint (SOL, CRUST, PUMP). SUI rate is not yet provided by the
 * API and will always be `null`.
 */
export function useCryptoPrices({
  enabled = true,
}: { enabled?: boolean } = {}): {
  solUsdRate: number | null;
  suiUsdRate: number | null;
  crustPriceUsd: number | null;
  pumpPriceUsd: number | null;
  solunaPriceUsd: number | null;
} {
  const [solUsdRate, setSolUsdRate] = useState<number | null>(null);
  const [crustPriceUsd, setCrustPriceUsd] = useState<number | null>(null);
  const [pumpPriceUsd, setPumpPriceUsd] = useState<number | null>(null);
  const [solunaPriceUsd, setSolunaPriceUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    fetch("/api/crypto/prices", { signal: ac.signal })
      .then((res) => res.json())
      .then((data: { SOL?: number; CRUST?: number; PUMP?: number; SOLUNA?: number }) => {
        if (typeof data?.SOL === "number" && data.SOL > 0)
          setSolUsdRate(data.SOL);
        if (typeof data?.CRUST === "number" && data.CRUST > 0)
          setCrustPriceUsd(data.CRUST);
        if (typeof data?.PUMP === "number" && data.PUMP > 0)
          setPumpPriceUsd(data.PUMP);
        if (typeof data?.SOLUNA === "number" && data.SOLUNA > 0)
          setSolunaPriceUsd(data.SOLUNA);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSolUsdRate(SOL_USD_FALLBACK);
        setCrustPriceUsd(null);
        setPumpPriceUsd(null);
        setSolunaPriceUsd(null);
      });
    return () => ac.abort();
  }, [enabled]);

  // suiUsdRate: not currently provided by the prices API
  return { solUsdRate, suiUsdRate: null, crustPriceUsd, pumpPriceUsd, solunaPriceUsd };
}
