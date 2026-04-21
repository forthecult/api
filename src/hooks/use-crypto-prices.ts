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
}: {
  enabled?: boolean;
} = {}): {
  crustPriceUsd: null | number;
  cultPriceUsd: null | number;
  pumpPriceUsd: null | number;
  seekerPriceUsd: null | number;
  solunaPriceUsd: null | number;
  solUsdRate: null | number;
  suiUsdRate: null | number;
} {
  const [solUsdRate, setSolUsdRate] = useState<null | number>(null);
  const [crustPriceUsd, setCrustPriceUsd] = useState<null | number>(null);
  const [cultPriceUsd, setCultPriceUsd] = useState<null | number>(null);
  const [pumpPriceUsd, setPumpPriceUsd] = useState<null | number>(null);
  const [solunaPriceUsd, setSolunaPriceUsd] = useState<null | number>(null);
  const [seekerPriceUsd, setSeekerPriceUsd] = useState<null | number>(null);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    fetch("/api/crypto/prices", { signal: ac.signal })
      .then((res) => res.json())
      .then((raw: unknown) => {
        const data = raw as {
          CRUST?: number;
          CULT?: number;
          PUMP?: number;
          SKR?: number;
          SOL?: number;
          SOLUNA?: number;
        };
        if (typeof data?.SOL === "number" && data.SOL > 0)
          setSolUsdRate(data.SOL);
        if (typeof data?.CRUST === "number" && data.CRUST > 0)
          setCrustPriceUsd(data.CRUST);
        if (typeof data?.CULT === "number" && data.CULT > 0)
          setCultPriceUsd(data.CULT);
        if (typeof data?.PUMP === "number" && data.PUMP > 0)
          setPumpPriceUsd(data.PUMP);
        if (typeof data?.SOLUNA === "number" && data.SOLUNA > 0)
          setSolunaPriceUsd(data.SOLUNA);
        if (typeof data?.SKR === "number" && data.SKR > 0)
          setSeekerPriceUsd(data.SKR);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSolUsdRate(SOL_USD_FALLBACK);
        setCrustPriceUsd(null);
        setCultPriceUsd(null);
        setPumpPriceUsd(null);
        setSolunaPriceUsd(null);
        setSeekerPriceUsd(null);
      });
    return () => ac.abort();
  }, [enabled]);

  // suiUsdRate: not currently provided by the prices API
  return {
    crustPriceUsd,
    cultPriceUsd,
    pumpPriceUsd,
    seekerPriceUsd,
    solunaPriceUsd,
    solUsdRate,
    suiUsdRate: null,
  };
}
