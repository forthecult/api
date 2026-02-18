"use client";

import * as React from "react";

export type CryptoCode =
  | "BTC"
  | "CRUST"
  | "CULT"
  | "DOGE"
  | "ETH"
  | "PUMP"
  | "SKR"
  | "SOL"
  | "TON"
  | "TROLL"
  | "XAG"
  | "XAU"
  | "XMR";

const COINGECKO_IDS: Record<
  Exclude<
    CryptoCode,
    "CRUST" | "CULT" | "PUMP" | "SKR" | "TROLL" | "XAG" | "XAU"
  >,
  string
> = {
  BTC: "bitcoin",
  DOGE: "dogecoin",
  ETH: "ethereum",
  SOL: "solana",
  TON: "toncoin",
  XMR: "monero",
};

const STORAGE_KEY = "crypto-currency";
const DEFAULT_CRYPTO: CryptoCode = "BTC";

export type Rates = Partial<Record<CryptoCode, number>>;

interface CryptoCurrencyContextType {
  convertUsdToCrypto: (usd: number) => null | number;
  formatCrypto: (amount: number) => string;
  rates: Rates;
  selectedCrypto: CryptoCode;
  setSelectedCrypto: (code: CryptoCode) => void;
}

const CryptoCurrencyContext = React.createContext<
  CryptoCurrencyContextType | undefined
>(undefined);

const DECIMAL_MAP: Record<CryptoCode, number> = {
  BTC: 6,
  CRUST: 6,
  CULT: 6,
  DOGE: 6,
  ETH: 6,
  PUMP: 6,
  SKR: 6,
  SOL: 4,
  TON: 4,
  TROLL: 6,
  XAG: 2,
  XAU: 2,
  XMR: 6,
};

/** Fallback when API fails; also used as initial state so consumers never see empty rates. */
const FALLBACK_RATES: Record<CryptoCode, number> = {
  BTC: 70_000,
  CRUST: 0,
  CULT: 0.0001,
  DOGE: 0.08,
  ETH: 2_300,
  PUMP: 0.01,
  SKR: 0.01,
  SOL: 100,
  TON: 5.5,
  TROLL: 1,
  XAG: 31,
  XAU: 2_650,
  XMR: 150,
};

export function CryptoCurrencyProvider({ children }: React.PropsWithChildren) {
  const [selectedCrypto, setSelectedCryptoState] =
    React.useState<CryptoCode>(DEFAULT_CRYPTO);
  const [rates, setRates] = React.useState<Rates>(() => ({
    ...FALLBACK_RATES,
  }));

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // Migrate away from CRUST (removed from footer widget) to PUMP
        const code = raw === "CRUST" ? "PUMP" : raw;
        if (
          code === "BTC" ||
          code === "ETH" ||
          code === "SOL" ||
          code === "DOGE" ||
          code === "PUMP" ||
          code === "TROLL" ||
          code === "TON" ||
          code === "XMR" ||
          code === "XAU" ||
          code === "XAG" ||
          code === "SKR" ||
          code === "CULT"
        ) {
          setSelectedCryptoState(code as CryptoCode);
          if (code !== raw) localStorage.setItem(STORAGE_KEY, code);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const setSelectedCrypto = React.useCallback((code: CryptoCode) => {
    setSelectedCryptoState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore
    }
  }, []);

  // Deferred price fetch: only fires when a component actually reads rates via
  // convertUsdToCrypto or the rates value. The provider starts with fallback
  // rates so UI renders immediately; real rates replace when loaded.
  // The fetch is triggered once (via ratesFetchedRef) on first access or after
  // a short idle delay, whichever comes first.
  const ratesFetchedRef = React.useRef(false);

  const fetchRates = React.useCallback(() => {
    if (ratesFetchedRef.current) return;
    ratesFetchedRef.current = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch("/api/crypto/prices", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<Partial<Record<CryptoCode, number>>>;
      })
      .then((data) => {
        if (!data || typeof data !== "object") {
          setRates({ ...FALLBACK_RATES });
          return;
        }
        const next: Rates = { ...FALLBACK_RATES };
        (
          [
            "BTC",
            "ETH",
            "SOL",
            "DOGE",
            "CRUST",
            "CULT",
            "PUMP",
            "TROLL",
            "TON",
            "XMR",
            "XAU",
            "XAG",
            "SKR",
          ] as const
        ).forEach((code) => {
          const v = data[code];
          if (typeof v === "number" && v > 0) next[code] = v;
        });
        setRates(next);
      })
      .catch(() => {
        // On timeout or error, keep fallback rates (already set as default)
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
  }, []);

  // Defer fetch by 2s after mount so initial load isn't blocked; fallback rates show until then.
  React.useEffect(() => {
    const timeoutId = window.setTimeout(fetchRates, 2000);
    return () => clearTimeout(timeoutId);
  }, [fetchRates]);

  const convertUsdToCrypto = React.useCallback(
    (usd: number): null | number => {
      const rate = rates[selectedCrypto];
      if (!rate || rate <= 0) return null;
      return usd / rate;
    },
    [rates, selectedCrypto],
  );

  const formatCrypto = React.useCallback(
    (amount: number): string => {
      const decimals = DECIMAL_MAP[selectedCrypto as CryptoCode];
      // Use Intl.NumberFormat for locale-aware thousand separators
      // e.g., 2182.633676 → "2,182.633676" (US) or "2.182,633676" (DE)
      const formatted = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: 0,
      }).format(amount);
      return `${formatted} ${selectedCrypto}`;
    },
    [selectedCrypto],
  );

  const value = React.useMemo<CryptoCurrencyContextType>(
    () => ({
      convertUsdToCrypto,
      formatCrypto,
      rates,
      selectedCrypto,
      setSelectedCrypto,
    }),
    [
      convertUsdToCrypto,
      formatCrypto,
      rates,
      selectedCrypto,
      setSelectedCrypto,
    ],
  );

  return (
    <CryptoCurrencyContext value={value}>{children}</CryptoCurrencyContext>
  );
}

/** SSR-safe fallback when CryptoCurrencyProvider is not in the tree. */
const CRYPTO_FALLBACK: CryptoCurrencyContextType = {
  convertUsdToCrypto: () => null,
  formatCrypto: (amount: number) => amount.toFixed(8),
  rates: {},
  selectedCrypto: "BTC",
  setSelectedCrypto: () => {},
};

export function useCryptoCurrency(): CryptoCurrencyContextType {
  const ctx = React.use(CryptoCurrencyContext);
  if (!ctx) {
    if (typeof window === "undefined") return CRYPTO_FALLBACK;
    console.warn(
      "useCryptoCurrency: CryptoCurrencyProvider not found, using fallback",
    );
    return CRYPTO_FALLBACK;
  }
  return ctx;
}

// Use local assets so logos work offline; external URLs (e.g. cryptologos.cc) fail when network is down
export const CRYPTO_OPTIONS: {
  code: CryptoCode;
  iconSrc: string;
  label: string;
}[] = [
  {
    code: "BTC",
    iconSrc: "/crypto/bitcoin/bitcoin-logo.svg",
    label: "Bitcoin (BTC)",
  },
  {
    code: "ETH",
    iconSrc: "/crypto/ethereum/ethereum-logo.svg",
    label: "Ethereum (ETH)",
  },
  {
    code: "SOL",
    iconSrc: "/crypto/solana/solanaLogoMark.svg",
    label: "Solana (SOL)",
  },
  { code: "DOGE", iconSrc: "/payments/doge.svg", label: "Dogecoin (DOGE)" },
  {
    code: "PUMP",
    iconSrc: "/crypto/pump/pump-logomark.svg",
    label: "Pump (PUMP)",
  },
  {
    code: "TROLL",
    iconSrc: "/crypto/troll/troll-logomark.png",
    label: "Troll (TROLL)",
  },
  {
    code: "SKR",
    iconSrc: "/crypto/seeker/S_Token_Circle_White.svg",
    label: "Seeker (SKR)",
  },
  {
    code: "CULT",
    iconSrc: "/crypto/cult/cult-logo.svg",
    label: "Culture (CULT)",
  },
  {
    code: "XMR",
    iconSrc: "/crypto/monero/monero-xmr-logo.svg",
    label: "Monero (XMR)",
  },
  {
    code: "XAU",
    iconSrc: "/crypto/gold/gold-logo.svg",
    label: "Gold (XAU)",
  },
  {
    code: "XAG",
    iconSrc: "/crypto/silver/silver-logo.svg",
    label: "Silver (XAG)",
  },
];
