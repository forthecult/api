"use client";

import Image from "next/image";

import { cn } from "~/lib/cn";
import {
  CRYPTO_OPTIONS,
  type CryptoCode,
  MAX_PRICING_CRYPTO_LINES,
  useCryptoCurrency,
} from "~/lib/hooks/use-crypto-currency";
import { Checkbox } from "~/ui/primitives/checkbox";
import { DropdownMenuItem } from "~/ui/primitives/dropdown-menu";

const CRYPTO_ICON_SIZE = 20;

/**
 * Two columns: pick footer spot crypto (row, left) vs checkboxes for which
 * cryptos appear as price lines on product cards / PDP / quick view (max 2).
 */
export function CryptoPricingTogglesList({
  className,
  menuMode = false,
  onCryptoSelect,
}: {
  className?: string;
  /** Use menu items (for footer dropdown) instead of plain buttons. */
  menuMode?: boolean;
  onCryptoSelect: (code: CryptoCode) => void;
}) {
  const { pricingCryptoCodes, togglePricingCrypto } = useCryptoCurrency();

  const header = (
    <div
      className={`
        grid grid-cols-[minmax(0,1fr)_4.25rem] items-center gap-1 border-b
        border-border px-2 py-1.5
      `}
      role="presentation"
    >
      <span
        className={`
          text-[10px] font-medium tracking-wide text-muted-foreground uppercase
        `}
      >
        Footer spot
      </span>
      <span
        className={`
          text-center text-[10px] font-medium tracking-wide
          text-muted-foreground uppercase
        `}
        title={`Show on product cards (max ${String(MAX_PRICING_CRYPTO_LINES)})`}
      >
        Cards
      </span>
    </div>
  );

  const pricingCell = (code: CryptoCode, label: string) => (
    <div
      className={`
        flex h-full min-h-9 w-full flex-col items-center justify-center gap-0.5
        border-l border-border/60 pl-1
      `}
      data-crypto-pricing-toggle=""
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Checkbox
        aria-label={`Show ${label} on product prices`}
        checked={pricingCryptoCodes.includes(code)}
        className="size-4"
        onCheckedChange={() => {
          togglePricingCrypto(code);
        }}
      />
    </div>
  );

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {header}
      {CRYPTO_OPTIONS.map(({ code, iconSrc, label }) => {
        if (menuMode) {
          return (
            <DropdownMenuItem
              className={`
                !flex h-auto w-full cursor-default flex-row items-stretch gap-0
                rounded-none border-b border-border/50 px-0 py-0
                last:border-b-0
                focus:bg-accent/80
              `}
              key={code}
              onSelect={(event) => {
                const t = event.target as HTMLElement | null;
                if (t?.closest("[data-crypto-pricing-toggle]")) {
                  event.preventDefault();
                  return;
                }
                onCryptoSelect(code);
              }}
            >
              <span
                className={`
                  flex min-w-0 flex-1 cursor-default items-center gap-2 px-2
                  py-2 text-left text-sm
                `}
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
                <span className="truncate">{label}</span>
              </span>
              <div
                className={`
                  flex w-[4.25rem] shrink-0 items-stretch justify-center py-1
                  pr-1
                `}
              >
                {pricingCell(code, label)}
              </div>
            </DropdownMenuItem>
          );
        }

        return (
          <div
            className={`
              grid grid-cols-[minmax(0,1fr)_4.25rem] items-stretch gap-0
              border-b border-border/50
              last:border-b-0
            `}
            key={code}
          >
            <button
              className={`
                flex min-w-0 items-center gap-2 px-2 py-2 text-left text-sm
                hover:bg-muted/50
              `}
              onClick={() => onCryptoSelect(code)}
              type="button"
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
              <span className="truncate">{label}</span>
            </button>
            <div
              className={`
                flex items-stretch justify-center border-l border-border/60 py-1
                pr-1
              `}
            >
              {pricingCell(code, label)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
