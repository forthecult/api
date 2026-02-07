"use client";

import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { CryptoCode } from "~/lib/hooks/use-crypto-currency";
import {
  CRYPTO_OPTIONS,
  useCryptoCurrency,
} from "~/lib/hooks/use-crypto-currency";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  CURRENCY_OPTIONS,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { countryFlag } from "~/lib/country-flag";
import { SEO_CONFIG } from "~/app";
import { Button } from "~/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/ui/primitives/dropdown-menu";

// Lazy load FooterPreferencesModal - only needed when user opens preferences
const FooterPreferencesModal = dynamic(
  () =>
    import("~/ui/components/footer/FooterPreferencesModal").then(
      (mod) => mod.FooterPreferencesModal,
    ),
  { ssr: false },
);

const CRYPTO_ICON_SIZE = 20;

const CRYPTO_COLORS: Record<CryptoCode, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#0D9488",
  DOGE: "#C2A633",
  CRUST: "#9945FF",
  PUMP: "#00D26A",
  TON: "#0088CC",
  XMR: "#FF6600",
  XAU: "#FFD700",
  XAG: "#C0C0C0",
};

export function FooterBottom() {
  const [mounted, setMounted] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { rates, selectedCrypto, setSelectedCrypto } = useCryptoCurrency();
  const { currency, convertUsdToFiat, formatFiat, selectedCountry } =
    useCountryCurrency();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentCrypto = mounted
    ? CRYPTO_OPTIONS.find((o) => o.code === selectedCrypto)
    : CRYPTO_OPTIONS[0];
  const currentLabel =
    currentCrypto?.label ?? (mounted ? selectedCrypto : "BTC");
  const currentCountry = mounted
    ? COUNTRY_OPTIONS_ALPHABETICAL.find((o) => o.code === selectedCountry)
    : COUNTRY_OPTIONS_ALPHABETICAL[0];
  const currentCurrencyOption = mounted
    ? CURRENCY_OPTIONS.find((o) => o.code === currency)
    : CURRENCY_OPTIONS[0];

  const usdPrice = mounted ? rates[selectedCrypto] : undefined;
  const fiatPrice =
    mounted && usdPrice != null && usdPrice > 0
      ? (() => {
          const fiat = convertUsdToFiat(usdPrice);
          if (fiat == null) return null;
          if (
            selectedCrypto === "DOGE" ||
            selectedCrypto === "PUMP" ||
            selectedCrypto === "XMR"
          ) {
            return new Intl.NumberFormat(undefined, {
              style: "currency",
              currency,
              minimumFractionDigits: 4,
              maximumFractionDigits: 6,
            }).format(fiat);
          }
          return formatFiat(fiat);
        })()
      : null;

  const prefsLabel =
    mounted && currentCountry && currentCurrencyOption
      ? `${currentCountry.countryName} • ${currentCurrencyOption.code}`
      : "Country • Currency";

  return (
    <div
      className={`
        flex flex-col items-center justify-between gap-4
        md:flex-row
      `}
    >
      <p className="text-sm text-muted-foreground">
        COPYLEFT {new Date().getFullYear()} {SEO_CONFIG.name}
      </p>
      <div
        className={`
          flex flex-col items-center gap-4 text-sm text-muted-foreground
          md:flex-row md:flex-wrap md:justify-center md:gap-4
        `}
      >
        {fiatPrice != null && currentCrypto && (
          <span
            className={`flex items-center gap-1.5 font-medium ${selectedCrypto === "SOL" || selectedCrypto === "PUMP" ? "font-semibold" : ""}`}
            style={{ color: CRYPTO_COLORS[selectedCrypto] }}
          >
            <Image
              alt=""
              aria-hidden
              className="shrink-0 rounded object-contain"
              height={CRYPTO_ICON_SIZE}
              role="presentation"
              src={currentCrypto.iconSrc}
              unoptimized
              width={CRYPTO_ICON_SIZE}
            />
            {fiatPrice}
          </span>
        )}
        <div className="flex flex-col items-center justify-center gap-2 md:flex-row md:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-auto gap-1.5 px-0 py-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                variant="ghost"
              >
                {currentCrypto && (
                  <Image
                    alt=""
                    aria-hidden
                    className="shrink-0 rounded object-contain"
                    height={CRYPTO_ICON_SIZE}
                    role="presentation"
                    src={currentCrypto.iconSrc}
                    unoptimized
                    width={CRYPTO_ICON_SIZE}
                  />
                )}
                <span>{currentLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CRYPTO_OPTIONS.map(({ code, label, iconSrc }) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setSelectedCrypto(code)}
                  className="flex items-center gap-2"
                >
                  <Image
                    alt=""
                    aria-hidden
                    className="shrink-0 rounded object-contain"
                    height={CRYPTO_ICON_SIZE}
                    role="presentation"
                    src={iconSrc}
                    unoptimized
                    width={CRYPTO_ICON_SIZE}
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            className="h-auto gap-1.5 px-0 py-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            variant="ghost"
            onClick={() => setPrefsOpen(true)}
            aria-label="Country and payment currency"
          >
            {mounted && currentCountry ? (
              <span className="flex items-center gap-1.5" aria-hidden>
                <span>{countryFlag(currentCountry.code)}</span>
                <span>{prefsLabel}</span>
              </span>
            ) : (
              <span>{prefsLabel}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
          <FooterPreferencesModal
            open={prefsOpen}
            onOpenChange={setPrefsOpen}
          />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link className="hover:text-foreground" href="/policies/privacy">
            Privacy
          </Link>
          <Link className="hover:text-foreground" href="/policies/terms">
            Terms
          </Link>
          <Link className="hover:text-foreground" href="/cookies">
            Cookies
          </Link>
          <Link className="hover:text-foreground" href="/sitemap">
            Sitemap
          </Link>
        </div>
      </div>
    </div>
  );
}
