"use client";

import * as React from "react";

export type CountryCode =
  | "AE"
  | "AR"
  | "AT"
  | "AU"
  | "BE"
  | "BR"
  | "BZ"
  | "CA"
  | "CH"
  | "CL"
  | "CR"
  | "DE"
  | "DK"
  | "EE"
  | "ES"
  | "FI"
  | "FJ"
  | "FR"
  | "GB"
  | "HK"
  | "IE"
  | "IL"
  | "IN"
  | "IS"
  | "IT"
  | "JP"
  | "KN"
  | "KR"
  | "LI"
  | "LT"
  | "LU"
  | "ME"
  | "MX"
  | "NL"
  | "NO"
  | "NZ"
  | "PA"
  | "PH"
  | "PL"
  | "PT"
  | "QA"
  | "SA"
  | "SE"
  | "SG"
  | "SV"
  | "TW"
  | "US";

const STORAGE_KEY = "country-currency";
const COOKIE_NAME = "country-currency";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const DEFAULT_COUNTRY: CountryCode = "US";

const FALLBACK_RATES: Rates = {
  AED: 3.67,
  ARS: 1200,
  AUD: 1.53,
  BRL: 4.97,
  BZD: 2,
  CAD: 1.36,
  CHF: 0.88,
  CLP: 950,
  CRC: 530,
  DKK: 6.9,
  EUR: 0.92,
  FJD: 2.25,
  GBP: 0.79,
  HKD: 7.82,
  ILS: 3.67,
  INR: 83,
  ISK: 140,
  JPY: 149,
  KRW: 1320,
  MXN: 17.1,
  NOK: 10.9,
  NZD: 1.66,
  PHP: 56.2,
  PLN: 4,
  QAR: 3.64,
  SAR: 3.75,
  SEK: 10.8,
  SGD: 1.35,
  TWD: 31.5,
  USD: 1,
  XCD: 2.7,
};

function getCurrencySymbol(currency: string): string {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: "currency",
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    return symbolPart?.value ?? currency;
  } catch {
    return currency;
  }
}

function isValidCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === "string" && COUNTRY_OPTIONS.some((o) => o.code === value)
  );
}

/** Country name only (no currency in label) for Preferences display. */
export const COUNTRY_OPTIONS: {
  code: CountryCode;
  countryName: string;
  currency: string;
  label: string;
  symbol: string;
}[] = [
  {
    code: "US",
    countryName: "United States",
    currency: "USD",
    label: "United States (USD)",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "CA",
    countryName: "Canada",
    currency: "CAD",
    label: "Canada (CAD)",
    symbol: getCurrencySymbol("CAD"),
  },
  {
    code: "AU",
    countryName: "Australia",
    currency: "AUD",
    label: "Australia (AUD)",
    symbol: getCurrencySymbol("AUD"),
  },
  {
    code: "NZ",
    countryName: "New Zealand",
    currency: "NZD",
    label: "New Zealand (NZD)",
    symbol: getCurrencySymbol("NZD"),
  },
  {
    code: "DE",
    countryName: "Germany",
    currency: "EUR",
    label: "Germany (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "GB",
    countryName: "United Kingdom",
    currency: "GBP",
    label: "United Kingdom (GBP)",
    symbol: getCurrencySymbol("GBP"),
  },
  {
    code: "ES",
    countryName: "Spain",
    currency: "EUR",
    label: "Spain (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "IT",
    countryName: "Italy",
    currency: "EUR",
    label: "Italy (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "FR",
    countryName: "France",
    currency: "EUR",
    label: "France (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "NL",
    countryName: "Netherlands",
    currency: "EUR",
    label: "Netherlands (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "JP",
    countryName: "Japan",
    currency: "JPY",
    label: "Japan (JPY)",
    symbol: getCurrencySymbol("JPY"),
  },
  {
    code: "HK",
    countryName: "Hong Kong",
    currency: "HKD",
    label: "Hong Kong (HKD)",
    symbol: getCurrencySymbol("HKD"),
  },
  {
    code: "IL",
    countryName: "Israel",
    currency: "ILS",
    label: "Israel (ILS)",
    symbol: getCurrencySymbol("ILS"),
  },
  {
    code: "KR",
    countryName: "South Korea",
    currency: "KRW",
    label: "South Korea (KRW)",
    symbol: getCurrencySymbol("KRW"),
  },
  {
    code: "SV",
    countryName: "El Salvador",
    currency: "USD",
    label: "El Salvador (USD)",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "AE",
    countryName: "United Arab Emirates",
    currency: "AED",
    label: "United Arab Emirates (AED)",
    symbol: getCurrencySymbol("AED"),
  },
  {
    code: "MX",
    countryName: "Mexico",
    currency: "MXN",
    label: "Mexico (MXN)",
    symbol: getCurrencySymbol("MXN"),
  },
  {
    code: "PH",
    countryName: "Philippines",
    currency: "PHP",
    label: "Philippines (PHP)",
    symbol: getCurrencySymbol("PHP"),
  },
  {
    code: "IN",
    countryName: "India",
    currency: "INR",
    label: "India (INR)",
    symbol: getCurrencySymbol("INR"),
  },
  {
    code: "BR",
    countryName: "Brazil",
    currency: "BRL",
    label: "Brazil (BRL)",
    symbol: getCurrencySymbol("BRL"),
  },
  {
    code: "PA",
    countryName: "Panama",
    currency: "USD",
    label: "Panama (USD)",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "AR",
    countryName: "Argentina",
    currency: "ARS",
    label: "Argentina (ARS)",
    symbol: getCurrencySymbol("ARS"),
  },
  {
    code: "KN",
    countryName: "Saint Kitts and Nevis",
    currency: "XCD",
    label: "Saint Kitts and Nevis (XCD)",
    symbol: getCurrencySymbol("XCD"),
  },
  {
    code: "CR",
    countryName: "Costa Rica",
    currency: "CRC",
    label: "Costa Rica (CRC)",
    symbol: getCurrencySymbol("CRC"),
  },
  {
    code: "BZ",
    countryName: "Belize",
    currency: "BZD",
    label: "Belize (BZD)",
    symbol: getCurrencySymbol("BZD"),
  },
  {
    code: "CL",
    countryName: "Chile",
    currency: "CLP",
    label: "Chile (CLP)",
    symbol: getCurrencySymbol("CLP"),
  },
  {
    code: "CH",
    countryName: "Switzerland",
    currency: "CHF",
    label: "Switzerland (CHF)",
    symbol: getCurrencySymbol("CHF"),
  },
  {
    code: "SG",
    countryName: "Singapore",
    currency: "SGD",
    label: "Singapore (SGD)",
    symbol: getCurrencySymbol("SGD"),
  },
  {
    code: "IS",
    countryName: "Iceland",
    currency: "ISK",
    label: "Iceland (ISK)",
    symbol: getCurrencySymbol("ISK"),
  },
  {
    code: "DK",
    countryName: "Denmark",
    currency: "DKK",
    label: "Denmark (DKK)",
    symbol: getCurrencySymbol("DKK"),
  },
  {
    code: "ME",
    countryName: "Montenegro",
    currency: "EUR",
    label: "Montenegro (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "PT",
    countryName: "Portugal",
    currency: "EUR",
    label: "Portugal (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "PL",
    countryName: "Poland",
    currency: "PLN",
    label: "Poland (PLN)",
    symbol: getCurrencySymbol("PLN"),
  },
  {
    code: "FI",
    countryName: "Finland",
    currency: "EUR",
    label: "Finland (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LT",
    countryName: "Lithuania",
    currency: "EUR",
    label: "Lithuania (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LU",
    countryName: "Luxembourg",
    currency: "EUR",
    label: "Luxembourg (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LI",
    countryName: "Liechtenstein",
    currency: "CHF",
    label: "Liechtenstein (CHF)",
    symbol: getCurrencySymbol("CHF"),
  },
  {
    code: "BE",
    countryName: "Belgium",
    currency: "EUR",
    label: "Belgium (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "SE",
    countryName: "Sweden",
    currency: "SEK",
    label: "Sweden (SEK)",
    symbol: getCurrencySymbol("SEK"),
  },
  {
    code: "IE",
    countryName: "Ireland",
    currency: "EUR",
    label: "Ireland (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "AT",
    countryName: "Austria",
    currency: "EUR",
    label: "Austria (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "NO",
    countryName: "Norway",
    currency: "NOK",
    label: "Norway (NOK)",
    symbol: getCurrencySymbol("NOK"),
  },
  {
    code: "EE",
    countryName: "Estonia",
    currency: "EUR",
    label: "Estonia (EUR)",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "SA",
    countryName: "Saudi Arabia",
    currency: "SAR",
    label: "Saudi Arabia (SAR)",
    symbol: getCurrencySymbol("SAR"),
  },
  {
    code: "QA",
    countryName: "Qatar",
    currency: "QAR",
    label: "Qatar (QAR)",
    symbol: getCurrencySymbol("QAR"),
  },
  {
    code: "TW",
    countryName: "Taiwan",
    currency: "TWD",
    label: "Taiwan (TWD)",
    symbol: getCurrencySymbol("TWD"),
  },
  {
    code: "FJ",
    countryName: "Fiji",
    currency: "FJD",
    label: "Fiji (FJD)",
    symbol: getCurrencySymbol("FJD"),
  },
];

export const COUNTRY_OPTIONS_ALPHABETICAL = [...COUNTRY_OPTIONS].sort((a, b) =>
  a.countryName.localeCompare(b.countryName),
);

/** Language options for the preferences modal. Only English for now; more languages when copy/design is ready. */
export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
];

/** Unique currencies for Payment currency selector (code, label, symbol). */
export const CURRENCY_OPTIONS: {
  code: string;
  label: string;
  symbol: string;
}[] = (() => {
  const seen = new Set<string>();
  const out: { code: string; label: string; symbol: string }[] = [];
  const names: Record<string, string> = {
    AED: "UAE Dirham",
    ARS: "Argentine Peso",
    AUD: "Australian Dollar",
    BRL: "Brazilian Real",
    BZD: "Belize Dollar",
    CAD: "Canadian Dollar",
    CHF: "Swiss Franc",
    CLP: "Chilean Peso",
    CRC: "Costa Rican Colón",
    DKK: "Danish Krone",
    EUR: "Euro",
    FJD: "Fijian Dollar",
    GBP: "British Pound",
    HKD: "Hong Kong Dollar",
    ILS: "Israeli Shekel",
    INR: "Indian Rupee",
    ISK: "Icelandic Króna",
    JPY: "Japanese Yen",
    KRW: "South Korean Won",
    MXN: "Mexican Peso",
    NOK: "Norwegian Krone",
    NZD: "New Zealand Dollar",
    PHP: "Philippine Peso",
    PLN: "Polish Złoty",
    QAR: "Qatari Riyal",
    SAR: "Saudi Riyal",
    SEK: "Swedish Krona",
    SGD: "Singapore Dollar",
    TWD: "New Taiwan Dollar",
    USD: "US Dollar",
    XCD: "East Caribbean Dollar",
  };
  for (const o of COUNTRY_OPTIONS) {
    if (seen.has(o.currency)) continue;
    seen.add(o.currency);
    out.push({
      code: o.currency,
      label: names[o.currency] ?? o.currency,
      symbol: o.symbol,
    });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
})();

interface CountryCurrencyContextType {
  convertUsdToFiat: (usd: number) => null | number;
  currency: string;
  formatFiat: (amount: number) => string;
  rates: Rates;
  selectedCountry: CountryCode;
  setCurrency: (code: string) => void;
  setPreferences: (country: CountryCode, currency: string) => void;
  setSelectedCountry: (code: CountryCode) => void;
}

type Rates = Partial<Record<string, number>>;

interface StoredPrefs {
  country: CountryCode;
  currency: string;
}

/** Default currency for a country (used for geo default). */
export function defaultCurrencyForCountry(countryCode: CountryCode): string {
  return COUNTRY_OPTIONS.find((o) => o.code === countryCode)?.currency ?? "USD";
}

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_OPTIONS.some((o) => o.code === code);
}

const CountryCurrencyContext = React.createContext<
  CountryCurrencyContextType | undefined
>(undefined);

const CURRENCY_DECIMALS: Record<string, number> = {
  AED: 2,
  ARS: 2,
  AUD: 2,
  BRL: 2,
  BZD: 2,
  CAD: 2,
  CHF: 2,
  CLP: 0,
  CRC: 0,
  DKK: 2,
  EUR: 2,
  FJD: 2,
  GBP: 2,
  HKD: 2,
  ILS: 2,
  INR: 2,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  MXN: 2,
  NOK: 2,
  NZD: 2,
  PHP: 2,
  PLN: 2,
  QAR: 2,
  SAR: 2,
  SEK: 2,
  SGD: 2,
  TWD: 2,
  USD: 2,
  XCD: 2,
};

const CURRENCY_LOCALE: Record<string, string> = {
  AED: "ar-AE",
  ARS: "es-AR",
  AUD: "en-AU",
  BRL: "pt-BR",
  BZD: "en-BZ",
  CAD: "en-CA",
  CHF: "de-CH",
  CLP: "es-CL",
  CRC: "es-CR",
  DKK: "da-DK",
  EUR: "de-DE",
  FJD: "en-FJ",
  GBP: "en-GB",
  HKD: "zh-HK",
  ILS: "he-IL",
  INR: "en-IN",
  ISK: "is-IS",
  JPY: "ja-JP",
  KRW: "ko-KR",
  MXN: "es-MX",
  NOK: "nb-NO",
  NZD: "en-NZ",
  PHP: "en-PH",
  PLN: "pl-PL",
  QAR: "ar-QA",
  SAR: "ar-SA",
  SEK: "sv-SE",
  SGD: "en-SG",
  TWD: "zh-TW",
  USD: "en-US",
  XCD: "en-US",
};

type CountryCurrencyProviderProps = React.PropsWithChildren<{
  initialCountry?: null | string;
}>;

export function CountryCurrencyProvider({
  children,
  initialCountry,
}: CountryCurrencyProviderProps) {
  // Check if we have a valid initial country from cookie (set by middleware)
  const hasValidInitialCountry =
    initialCountry != null && isValidCountryCode(initialCountry);
  const geoCountry = hasValidInitialCountry
    ? (initialCountry as CountryCode)
    : DEFAULT_COUNTRY;
  const geoCurrency = defaultCurrencyForCountry(geoCountry);

  const [selectedCountry, setSelectedCountryState] =
    React.useState<CountryCode>(geoCountry);
  const [selectedCurrency, setSelectedCurrencyState] =
    React.useState<string>(geoCurrency);
  const [rates, setRates] = React.useState<Rates>(FALLBACK_RATES);
  const [geoFetched, setGeoFetched] = React.useState(false);

  // Fetch geo from API if no initial country was provided (first visit without middleware geo)
  React.useEffect(() => {
    // Skip if we already have a valid country from cookie/middleware or localStorage
    if (hasValidInitialCountry || geoFetched) return;

    // Check localStorage first - if user has saved preferences, don't override
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setGeoFetched(true);
        return; // User has saved preferences, don't fetch geo
      }
    } catch {
      // ignore
    }

    // Fetch geo from API to detect user's country
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: { country?: null | string }) => {
        if (data.country && isValidCountryCode(data.country)) {
          const detectedCountry = data.country as CountryCode;
          const detectedCurrency = defaultCurrencyForCountry(detectedCountry);
          setSelectedCountryState(detectedCountry);
          setSelectedCurrencyState(detectedCurrency);
          // Set cookie so next page load uses the detected country
          document.cookie = `${COOKIE_NAME}=${detectedCountry}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
        }
      })
      .catch(() => {
        // Ignore errors, keep default
      })
      .finally(() => {
        setGeoFetched(true);
      });
  }, [hasValidInitialCountry, geoFetched]);

  // Load preferences from localStorage (user's explicit choice takes priority)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPrefs | string;
        const country =
          typeof parsed === "string"
            ? isValidCountryCode(parsed)
              ? (parsed as CountryCode)
              : null
            : parsed && isValidCountryCode(parsed.country)
              ? parsed.country
              : null;
        const currency =
          typeof parsed === "object" &&
          parsed?.currency &&
          isValidCurrencyCode(parsed.currency)
            ? parsed.currency
            : country
              ? defaultCurrencyForCountry(country)
              : null;
        if (country) {
          setSelectedCountryState(country);
          document.cookie = `${COOKIE_NAME}=${country}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
        }
        if (currency) setSelectedCurrencyState(currency);
      }
    } catch {
      // ignore
    }
  }, []);

  const persist = React.useCallback(
    (country: CountryCode, currency: string) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ country, currency }),
        );
        document.cookie = `${COOKIE_NAME}=${country}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      } catch {
        // ignore
      }
    },
    [],
  );

  const setSelectedCountry = React.useCallback(
    (code: CountryCode) => {
      setSelectedCountryState(code);
      persist(code, selectedCurrency);
    },
    [persist, selectedCurrency],
  );

  const setCurrency = React.useCallback(
    (code: string) => {
      if (!isValidCurrencyCode(code)) return;
      setSelectedCurrencyState(code);
      persist(selectedCountry, code);
    },
    [persist, selectedCountry],
  );

  const setPreferences = React.useCallback(
    (country: CountryCode, currency: string) => {
      const cur = isValidCurrencyCode(currency)
        ? currency
        : defaultCurrencyForCountry(country);
      setSelectedCountryState(country);
      setSelectedCurrencyState(cur);
      persist(country, cur);
    },
    [persist],
  );

  // Fetch exchange rates with caching and timeout to prevent blocking navigation
  React.useEffect(() => {
    const RATES_CACHE_KEY = "exchange-rates-cache";
    const RATES_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
    const FETCH_TIMEOUT = 5000; // 5 second timeout

    // Try to load from cache first
    try {
      const cached = localStorage.getItem(RATES_CACHE_KEY);
      if (cached) {
        const { rates: cachedRates, timestamp } = JSON.parse(cached) as {
          rates: Record<string, number>;
          timestamp: number;
        };
        if (cachedRates && Date.now() - timestamp < RATES_CACHE_TTL) {
          setRates(cachedRates);
          return; // Cache is fresh, no need to fetch
        }
      }
    } catch {
      // Ignore cache errors
    }

    // Fetch with timeout to prevent blocking
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    fetch("https://api.exchangerate-api.com/v4/latest/USD", {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: unknown) => {
        const d = data as { rates?: Record<string, number> };
        if (d?.rates) {
          setRates(d.rates);
          // Cache the result
          try {
            localStorage.setItem(
              RATES_CACHE_KEY,
              JSON.stringify({ rates: d.rates, timestamp: Date.now() }),
            );
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch(() => {
        // On error/timeout, use fallback rates (already set as default)
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const currency = selectedCurrency;

  const convertUsdToFiat = React.useCallback(
    (usd: number): null | number => {
      const rate = rates[currency];
      if (!rate || rate <= 0) return null;
      return usd * rate;
    },
    [rates, currency],
  );

  const formatFiat = React.useCallback(
    (amount: number): string => {
      const locale = CURRENCY_LOCALE[currency] ?? "en-US";
      return new Intl.NumberFormat(locale, {
        currency,
        maximumFractionDigits: CURRENCY_DECIMALS[currency] ?? 2,
        minimumFractionDigits: CURRENCY_DECIMALS[currency] ?? 2,
        style: "currency",
      }).format(amount);
    },
    [currency],
  );

  const value = React.useMemo<CountryCurrencyContextType>(
    () => ({
      convertUsdToFiat,
      currency,
      formatFiat,
      rates,
      selectedCountry,
      setCurrency,
      setPreferences,
      setSelectedCountry,
    }),
    [
      convertUsdToFiat,
      formatFiat,
      rates,
      selectedCountry,
      setSelectedCountry,
      currency,
      setCurrency,
      setPreferences,
    ],
  );

  return (
    <CountryCurrencyContext value={value}>{children}</CountryCurrencyContext>
  );
}

/** SSR-safe fallback when CountryCurrencyProvider is not in the tree. */
const COUNTRY_CURRENCY_FALLBACK: CountryCurrencyContextType = {
  convertUsdToFiat: () => null,
  currency: "USD",
  formatFiat: (amount: number) => `$${amount.toFixed(2)}`,
  rates: {},
  selectedCountry: "US",
  setCurrency: () => {},
  setPreferences: () => {},
  setSelectedCountry: () => {},
};

export function useCountryCurrency(): CountryCurrencyContextType {
  const ctx = React.use(CountryCurrencyContext);
  if (!ctx) {
    if (typeof window === "undefined") return COUNTRY_CURRENCY_FALLBACK;
    // On the client, return fallback instead of throwing to survive provider
    // tree failures (e.g. wallet extension crashes above this provider).
    console.warn(
      "useCountryCurrency: CountryCurrencyProvider not found, using fallback",
    );
    return COUNTRY_CURRENCY_FALLBACK;
  }
  return ctx;
}
