"use client";

import * as React from "react";

export type CryptoCode =
  | "BTC"
  | "ETH"
  | "SOL"
  | "DOGE"
  | "CRUST"
  | "PUMP"
  | "TROLL"
  | "TON"
  | "XMR"
  | "XAU"
  | "XAG"
  | "SKR";

const COINGECKO_IDS: Record<
  Exclude<CryptoCode, "CRUST" | "PUMP" | "TROLL" | "XAU" | "XAG" | "SKR">,
  string
> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  DOGE: "dogecoin",
  TON: "toncoin",
  XMR: "monero",
};

const STORAGE_KEY = "crypto-currency";
const DEFAULT_CRYPTO: CryptoCode = "BTC";

export type Rates = Partial<Record<CryptoCode, number>>;

type CryptoCurrencyContextType = {
  convertUsdToCrypto: (usd: number) => number | null;
  formatCrypto: (amount: number) => string;
  rates: Rates;
  selectedCrypto: CryptoCode;
  setSelectedCrypto: (code: CryptoCode) => void;
};

const CryptoCurrencyContext = React.createContext<
  CryptoCurrencyContextType | undefined
>(undefined);

const DECIMAL_MAP: Record<CryptoCode, number> = {
  BTC: 6,
  ETH: 6,
  SOL: 4,
  DOGE: 6,
  CRUST: 6,
  PUMP: 6,
  TROLL: 6,
  TON: 4,
  XMR: 6,
  XAU: 2,
  XAG: 2,
  SKR: 6,
};

/** Fallback when API fails; also used as initial state so consumers never see empty rates. */
const FALLBACK_RATES: Record<CryptoCode, number> = {
  BTC: 70_000,
  ETH: 2_300,
  SOL: 100,
  DOGE: 0.08,
  CRUST: 0,
  PUMP: 0.01,
  TROLL: 1,
  TON: 5.5,
  XMR: 150,
  XAU: 2_650,
  XAG: 31,
  SKR: 0.01,
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
          code === "SKR"
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

  // Single API call (server caches 60s). Page renders with fallback rates; real rates replace when loaded.
  // Uses timeout to prevent blocking navigation if API is slow.
  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

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

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const convertUsdToCrypto = React.useCallback(
    (usd: number): number | null => {
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
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
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
    <CryptoCurrencyContext.Provider value={value}>
      {children}
    </CryptoCurrencyContext.Provider>
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
  const ctx = React.useContext(CryptoCurrencyContext);
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
  label: string;
  iconSrc: string;
}[] = [
  {
    code: "BTC",
    label: "Bitcoin (BTC)",
    iconSrc: "/crypto/bitcoin/bitcoin-logo.svg",
  },
  {
    code: "ETH",
    label: "Ethereum (ETH)",
    iconSrc: "/crypto/ethereum/ethereum-logo.svg",
  },
  {
    code: "SOL",
    label: "Solana (SOL)",
    iconSrc: "/crypto/solana/solanaLogoMark.svg",
  },
  { code: "DOGE", label: "Dogecoin (DOGE)", iconSrc: "/payments/doge.svg" },
  {
    code: "PUMP",
    label: "Pump (PUMP)",
    iconSrc: "/crypto/pump/pump-logomark.svg",
  },
  {
    code: "TROLL",
    label: "Troll (TROLL)",
    iconSrc: "/crypto/troll/troll-logomark.png",
  },
  {
    code: "SKR",
    label: "Seeker (SKR)",
    iconSrc: "/crypto/seeker/S_Token_Circle_White.svg",
  },
  {
    code: "XMR",
    label: "Monero (XMR)",
    iconSrc: "/crypto/monero/monero-xmr-logo.svg",
  },
  {
    code: "XAU",
    label: "Gold (XAU)",
    iconSrc: "/crypto/gold/gold-logo.svg",
  },
  {
    code: "XAG",
    label: "Silver (XAG)",
    iconSrc: "/crypto/silver/silver-logo.svg",
  },
];
