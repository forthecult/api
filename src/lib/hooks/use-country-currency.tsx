"use client";

import * as React from "react";

export type CountryCode =
  | "US"
  | "CA"
  | "AU"
  | "NZ"
  | "DE"
  | "GB"
  | "ES"
  | "IT"
  | "JP"
  | "HK"
  | "IL"
  | "KR"
  | "SV"
  | "AE"
  | "MX"
  | "PH"
  | "FR"
  | "NL"
  | "IN"
  | "BR"
  | "PA"
  | "AR"
  | "KN"
  | "CR"
  | "BZ"
  | "CL"
  | "CH"
  | "SG"
  | "IS"
  | "DK"
  | "ME"
  | "PT"
  | "PL"
  | "FI"
  | "LT"
  | "LU"
  | "LI"
  | "BE"
  | "SE"
  | "IE"
  | "AT"
  | "NO"
  | "EE"
  | "SA"
  | "QA"
  | "TW"
  | "FJ";

const STORAGE_KEY = "country-currency";
const COOKIE_NAME = "country-currency";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const DEFAULT_COUNTRY: CountryCode = "US";

const FALLBACK_RATES: Rates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  NZD: 1.66,
  JPY: 149,
  HKD: 7.82,
  ILS: 3.67,
  KRW: 1320,
  AED: 3.67,
  MXN: 17.1,
  PHP: 56.2,
  INR: 83,
  BRL: 4.97,
  SGD: 1.35,
  CHF: 0.88,
  ARS: 1200,
  XCD: 2.7,
  CRC: 530,
  BZD: 2,
  CLP: 950,
  ISK: 140,
  DKK: 6.9,
  PLN: 4,
  SEK: 10.8,
  NOK: 10.9,
  SAR: 3.75,
  QAR: 3.64,
  TWD: 31.5,
  FJD: 2.25,
};

function isValidCountryCode(value: unknown): value is CountryCode {
  return (
    typeof value === "string" && COUNTRY_OPTIONS.some((o) => o.code === value)
  );
}

function getCurrencySymbol(currency: string): string {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      currency,
      style: "currency",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const parts = formatter.formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    return symbolPart?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Country name only (no currency in label) for Preferences display. */
export const COUNTRY_OPTIONS: {
  code: CountryCode;
  label: string;
  countryName: string;
  currency: string;
  symbol: string;
}[] = [
  {
    code: "US",
    label: "United States (USD)",
    countryName: "United States",
    currency: "USD",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "CA",
    label: "Canada (CAD)",
    countryName: "Canada",
    currency: "CAD",
    symbol: getCurrencySymbol("CAD"),
  },
  {
    code: "AU",
    label: "Australia (AUD)",
    countryName: "Australia",
    currency: "AUD",
    symbol: getCurrencySymbol("AUD"),
  },
  {
    code: "NZ",
    label: "New Zealand (NZD)",
    countryName: "New Zealand",
    currency: "NZD",
    symbol: getCurrencySymbol("NZD"),
  },
  {
    code: "DE",
    label: "Germany (EUR)",
    countryName: "Germany",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "GB",
    label: "United Kingdom (GBP)",
    countryName: "United Kingdom",
    currency: "GBP",
    symbol: getCurrencySymbol("GBP"),
  },
  {
    code: "ES",
    label: "Spain (EUR)",
    countryName: "Spain",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "IT",
    label: "Italy (EUR)",
    countryName: "Italy",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "FR",
    label: "France (EUR)",
    countryName: "France",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "NL",
    label: "Netherlands (EUR)",
    countryName: "Netherlands",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "JP",
    label: "Japan (JPY)",
    countryName: "Japan",
    currency: "JPY",
    symbol: getCurrencySymbol("JPY"),
  },
  {
    code: "HK",
    label: "Hong Kong (HKD)",
    countryName: "Hong Kong",
    currency: "HKD",
    symbol: getCurrencySymbol("HKD"),
  },
  {
    code: "IL",
    label: "Israel (ILS)",
    countryName: "Israel",
    currency: "ILS",
    symbol: getCurrencySymbol("ILS"),
  },
  {
    code: "KR",
    label: "South Korea (KRW)",
    countryName: "South Korea",
    currency: "KRW",
    symbol: getCurrencySymbol("KRW"),
  },
  {
    code: "SV",
    label: "El Salvador (USD)",
    countryName: "El Salvador",
    currency: "USD",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "AE",
    label: "United Arab Emirates (AED)",
    countryName: "United Arab Emirates",
    currency: "AED",
    symbol: getCurrencySymbol("AED"),
  },
  {
    code: "MX",
    label: "Mexico (MXN)",
    countryName: "Mexico",
    currency: "MXN",
    symbol: getCurrencySymbol("MXN"),
  },
  {
    code: "PH",
    label: "Philippines (PHP)",
    countryName: "Philippines",
    currency: "PHP",
    symbol: getCurrencySymbol("PHP"),
  },
  {
    code: "IN",
    label: "India (INR)",
    countryName: "India",
    currency: "INR",
    symbol: getCurrencySymbol("INR"),
  },
  {
    code: "BR",
    label: "Brazil (BRL)",
    countryName: "Brazil",
    currency: "BRL",
    symbol: getCurrencySymbol("BRL"),
  },
  {
    code: "PA",
    label: "Panama (USD)",
    countryName: "Panama",
    currency: "USD",
    symbol: getCurrencySymbol("USD"),
  },
  {
    code: "AR",
    label: "Argentina (ARS)",
    countryName: "Argentina",
    currency: "ARS",
    symbol: getCurrencySymbol("ARS"),
  },
  {
    code: "KN",
    label: "Saint Kitts and Nevis (XCD)",
    countryName: "Saint Kitts and Nevis",
    currency: "XCD",
    symbol: getCurrencySymbol("XCD"),
  },
  {
    code: "CR",
    label: "Costa Rica (CRC)",
    countryName: "Costa Rica",
    currency: "CRC",
    symbol: getCurrencySymbol("CRC"),
  },
  {
    code: "BZ",
    label: "Belize (BZD)",
    countryName: "Belize",
    currency: "BZD",
    symbol: getCurrencySymbol("BZD"),
  },
  {
    code: "CL",
    label: "Chile (CLP)",
    countryName: "Chile",
    currency: "CLP",
    symbol: getCurrencySymbol("CLP"),
  },
  {
    code: "CH",
    label: "Switzerland (CHF)",
    countryName: "Switzerland",
    currency: "CHF",
    symbol: getCurrencySymbol("CHF"),
  },
  {
    code: "SG",
    label: "Singapore (SGD)",
    countryName: "Singapore",
    currency: "SGD",
    symbol: getCurrencySymbol("SGD"),
  },
  {
    code: "IS",
    label: "Iceland (ISK)",
    countryName: "Iceland",
    currency: "ISK",
    symbol: getCurrencySymbol("ISK"),
  },
  {
    code: "DK",
    label: "Denmark (DKK)",
    countryName: "Denmark",
    currency: "DKK",
    symbol: getCurrencySymbol("DKK"),
  },
  {
    code: "ME",
    label: "Montenegro (EUR)",
    countryName: "Montenegro",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "PT",
    label: "Portugal (EUR)",
    countryName: "Portugal",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "PL",
    label: "Poland (PLN)",
    countryName: "Poland",
    currency: "PLN",
    symbol: getCurrencySymbol("PLN"),
  },
  {
    code: "FI",
    label: "Finland (EUR)",
    countryName: "Finland",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LT",
    label: "Lithuania (EUR)",
    countryName: "Lithuania",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LU",
    label: "Luxembourg (EUR)",
    countryName: "Luxembourg",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "LI",
    label: "Liechtenstein (CHF)",
    countryName: "Liechtenstein",
    currency: "CHF",
    symbol: getCurrencySymbol("CHF"),
  },
  {
    code: "BE",
    label: "Belgium (EUR)",
    countryName: "Belgium",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "SE",
    label: "Sweden (SEK)",
    countryName: "Sweden",
    currency: "SEK",
    symbol: getCurrencySymbol("SEK"),
  },
  {
    code: "IE",
    label: "Ireland (EUR)",
    countryName: "Ireland",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "AT",
    label: "Austria (EUR)",
    countryName: "Austria",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "NO",
    label: "Norway (NOK)",
    countryName: "Norway",
    currency: "NOK",
    symbol: getCurrencySymbol("NOK"),
  },
  {
    code: "EE",
    label: "Estonia (EUR)",
    countryName: "Estonia",
    currency: "EUR",
    symbol: getCurrencySymbol("EUR"),
  },
  {
    code: "SA",
    label: "Saudi Arabia (SAR)",
    countryName: "Saudi Arabia",
    currency: "SAR",
    symbol: getCurrencySymbol("SAR"),
  },
  {
    code: "QA",
    label: "Qatar (QAR)",
    countryName: "Qatar",
    currency: "QAR",
    symbol: getCurrencySymbol("QAR"),
  },
  {
    code: "TW",
    label: "Taiwan (TWD)",
    countryName: "Taiwan",
    currency: "TWD",
    symbol: getCurrencySymbol("TWD"),
  },
  {
    code: "FJ",
    label: "Fiji (FJD)",
    countryName: "Fiji",
    currency: "FJD",
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
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    NZD: "New Zealand Dollar",
    JPY: "Japanese Yen",
    HKD: "Hong Kong Dollar",
    ILS: "Israeli Shekel",
    KRW: "South Korean Won",
    AED: "UAE Dirham",
    MXN: "Mexican Peso",
    PHP: "Philippine Peso",
    INR: "Indian Rupee",
    BRL: "Brazilian Real",
    SGD: "Singapore Dollar",
    CHF: "Swiss Franc",
    ARS: "Argentine Peso",
    XCD: "East Caribbean Dollar",
    CRC: "Costa Rican Colón",
    BZD: "Belize Dollar",
    CLP: "Chilean Peso",
    ISK: "Icelandic Króna",
    DKK: "Danish Krone",
    PLN: "Polish Złoty",
    SEK: "Swedish Krona",
    NOK: "Norwegian Krone",
    SAR: "Saudi Riyal",
    QAR: "Qatari Riyal",
    TWD: "New Taiwan Dollar",
    FJD: "Fijian Dollar",
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

/** Default currency for a country (used for geo default). */
export function defaultCurrencyForCountry(countryCode: CountryCode): string {
  return COUNTRY_OPTIONS.find((o) => o.code === countryCode)?.currency ?? "USD";
}

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_OPTIONS.some((o) => o.code === code);
}

type Rates = Partial<Record<string, number>>;

type StoredPrefs = { country: CountryCode; currency: string };

type CountryCurrencyContextType = {
  convertUsdToFiat: (usd: number) => number | null;
  formatFiat: (amount: number) => string;
  rates: Rates;
  selectedCountry: CountryCode;
  setSelectedCountry: (code: CountryCode) => void;
  currency: string;
  setCurrency: (code: string) => void;
  setPreferences: (country: CountryCode, currency: string) => void;
};

const CountryCurrencyContext = React.createContext<
  CountryCurrencyContextType | undefined
>(undefined);

const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  HKD: 2,
  ILS: 2,
  KRW: 0,
  AED: 2,
  MXN: 2,
  PHP: 2,
  INR: 2,
  BRL: 2,
  SGD: 2,
  CHF: 2,
  ARS: 2,
  XCD: 2,
  CRC: 0,
  BZD: 2,
  CLP: 0,
  ISK: 0,
  DKK: 2,
  PLN: 2,
  SEK: 2,
  NOK: 2,
  SAR: 2,
  QAR: 2,
  TWD: 2,
  FJD: 2,
};

const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  CAD: "en-CA",
  AUD: "en-AU",
  NZD: "en-NZ",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  HKD: "zh-HK",
  ILS: "he-IL",
  KRW: "ko-KR",
  AED: "ar-AE",
  MXN: "es-MX",
  PHP: "en-PH",
  INR: "en-IN",
  BRL: "pt-BR",
  SGD: "en-SG",
  CHF: "de-CH",
  ARS: "es-AR",
  XCD: "en-US",
  CRC: "es-CR",
  BZD: "en-BZ",
  CLP: "es-CL",
  ISK: "is-IS",
  DKK: "da-DK",
  PLN: "pl-PL",
  SEK: "sv-SE",
  NOK: "nb-NO",
  SAR: "ar-SA",
  QAR: "ar-QA",
  TWD: "zh-TW",
  FJD: "en-FJ",
};

type CountryCurrencyProviderProps = React.PropsWithChildren<{
  initialCountry?: string | null;
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
      .then((data: { country?: string | null }) => {
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
    (usd: number): number | null => {
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
        style: "currency",
        currency,
        minimumFractionDigits: CURRENCY_DECIMALS[currency] ?? 2,
        maximumFractionDigits: CURRENCY_DECIMALS[currency] ?? 2,
      }).format(amount);
    },
    [currency],
  );

  const value = React.useMemo<CountryCurrencyContextType>(
    () => ({
      convertUsdToFiat,
      formatFiat,
      rates,
      selectedCountry,
      setSelectedCountry,
      currency,
      setCurrency,
      setPreferences,
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
    <CountryCurrencyContext.Provider value={value}>
      {children}
    </CountryCurrencyContext.Provider>
  );
}

export function useCountryCurrency(): CountryCurrencyContextType {
  const ctx = React.use(CountryCurrencyContext);
  if (!ctx)
    throw new Error(
      "useCountryCurrency must be used within CountryCurrencyProvider",
    );
  return ctx;
}
