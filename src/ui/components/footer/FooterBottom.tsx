"use client";

import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { CryptoCode } from "~/lib/hooks/use-crypto-currency";

import { SEO_CONFIG } from "~/app";
import { countryFlag } from "~/lib/country-flag";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  CURRENCY_OPTIONS,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import {
  CRYPTO_OPTIONS,
  useCryptoCurrency,
} from "~/lib/hooks/use-crypto-currency";
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

const SIDESHIFT_CONFIG = {
  commissionRate: undefined,
  defaultDepositMethodId: "sol",
  defaultSettleMethodId: "eth",
  parentAffiliateId: "03RoxqMia",
  settleAddress: undefined,
  settleAmount: undefined,
  theme: "light",
  type: "variable",
} as const;

const SIDESHIFT_SCRIPT_URL = "https://sideshift.ai/static/js/main.js";

/** On mobile we open Sideshift in a new tab (full site is better than the embed). Affiliate ID at end. */
const SIDESHIFT_AFFILIATE_URL = "https://sideshift.ai/sol/eth/a/03RoxqMia";

const MOBILE_BREAKPOINT_PX = 768;

/** Load Sideshift script on demand and open the widget. No network cost until first click. */
function loadSideshiftAndShow(): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__SIDESHIFT__ = SIDESHIFT_CONFIG;
  const w = window as unknown as { sideshift?: { show: () => void } };

  const tryShow = () => {
    if (w.sideshift?.show) {
      w.sideshift.show();
      return true;
    }
    return false;
  };

  if (tryShow()) return;

  const existing = document.querySelector(`script[src="${SIDESHIFT_SCRIPT_URL}"]`);
  if (existing) {
    existing.addEventListener("load", () => {
      tryShow() || scheduleRetry();
    });
    tryShow() || scheduleRetry();
    return;
  }

  const script = document.createElement("script");
  script.src = SIDESHIFT_SCRIPT_URL;
  script.async = true;
  script.onload = () => {
    tryShow() || scheduleRetry();
  };
  document.body.appendChild(script);
}

/** Sideshift may set window.sideshift after script load; retry a few times. */
function scheduleRetry(): void {
  const w = window as unknown as { sideshift?: { show: () => void } };
  let attempts = 0;
  const maxAttempts = 20;
  const id = setInterval(() => {
    attempts++;
    if (w.sideshift?.show) {
      clearInterval(id);
      w.sideshift.show();
    } else if (attempts >= maxAttempts) {
      clearInterval(id);
    }
  }, 100);
}

const CRYPTO_COLORS: Record<CryptoCode, string> = {
  BTC: "#F7931A",
  CRUST: "#9945FF",
  DOGE: "#C2A633",
  ETH: "#627EEA",
  PUMP: "#00D26A",
  SKR: "#0EA5E9",
  SOL: "#0D9488",
  TON: "#0088CC",
  TROLL: "#6B7280",
  XAG: "#C0C0C0",
  XAU: "#FFD700",
  XMR: "#FF6600",
};

export function FooterBottom({
  onCryptoDropdownOpen,
}: {
  onCryptoDropdownOpen?: () => void;
} = {}) {
  const [mounted, setMounted] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const { rates, selectedCrypto, setSelectedCrypto } = useCryptoCurrency();
  const { convertUsdToFiat, currency, formatFiat, selectedCountry } =
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
            selectedCrypto === "TROLL" ||
            selectedCrypto === "XMR"
          ) {
            return new Intl.NumberFormat(undefined, {
              currency,
              maximumFractionDigits: 6,
              minimumFractionDigits: 4,
              style: "currency",
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
      <p className="text-base text-muted-foreground">
        COPYLEFT {new Date().getFullYear()} {SEO_CONFIG.name}
      </p>
      <div
        className={`
          flex flex-col items-center gap-4 text-base text-muted-foreground
          md:flex-row md:flex-wrap md:justify-center md:gap-4
        `}
      >
        {fiatPrice != null && currentCrypto && (
          <button
            type="button"
            aria-label="Shift crypto — open Sideshift"
            className={`
              font-mono-crypto flex cursor-pointer items-center gap-1.5 font-medium
              rounded-sm transition-opacity hover:opacity-80
              ${
                selectedCrypto === "SOL" || selectedCrypto === "PUMP"
                  ? `
                font-semibold
              `
                  : ""
              }
            `}
            style={{ color: CRYPTO_COLORS[selectedCrypto] }}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`).matches
              ) {
                window.open(SIDESHIFT_AFFILIATE_URL, "_blank", "noopener,noreferrer");
                return;
              }
              loadSideshiftAndShow();
            }}
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
          </button>
        )}
        <div
          className={`
          flex flex-col items-center justify-center gap-2
          md:flex-row md:gap-4
        `}
        >
          <DropdownMenu
            onOpenChange={(open) => {
              if (open) onCryptoDropdownOpen?.();
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                className={`
                  h-auto gap-1.5 px-0 py-0 text-sm text-muted-foreground
                  hover:bg-transparent hover:text-foreground
                `}
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
              {CRYPTO_OPTIONS.map(({ code, iconSrc, label }) => (
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  key={code}
                  onClick={() => setSelectedCrypto(code)}
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
            aria-label="Country and payment currency"
            className={`
              h-auto gap-1.5 px-0 py-0 text-sm text-muted-foreground
              hover:bg-transparent hover:text-foreground
            `}
            onClick={() => setPrefsOpen(true)}
            variant="ghost"
          >
            {mounted && currentCountry ? (
              <span aria-hidden className="flex items-center gap-1.5">
                <span
                  className={`
                  flex h-5 w-5 shrink-0 items-center justify-center text-base
                  leading-none
                `}
                >
                  {countryFlag(currentCountry.code)}
                </span>
                <span>{prefsLabel}</span>
              </span>
            ) : (
              <span>{prefsLabel}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>
          <FooterPreferencesModal
            onOpenChange={setPrefsOpen}
            open={prefsOpen}
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
