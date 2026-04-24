"use client";

import Image from "next/image";

import {
  CRYPTO_OPTIONS,
  useCryptoCurrency,
  type CryptoCode,
} from "~/lib/hooks/use-crypto-currency";
import { cn } from "~/lib/cn";
import { Checkbox } from "~/ui/primitives/checkbox";
import { DropdownMenuItem } from "~/ui/primitives/dropdown-menu";

const CRYPTO_ICON_SIZE = 20;

/**
 * Per-row crypto: choose shown fiat spot + checkbox for “show this crypto’s price
 * on product cards and PDP” (max 2). Used in footer menu and product popovers.
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

  return (
    <div className={cn("flex flex-col", className)}>
      {CRYPTO_OPTIONS.map(({ code, iconSrc, label }) => (
        <div
          className={`
            flex items-center justify-between gap-2 border-b
            border-border/50 px-2 py-1.5
            last:border-0
          `}
          key={code}
        >
          {menuMode ? (
            <DropdownMenuItem
              className={`
                flex min-w-0 flex-1 cursor-pointer items-center gap-2
                p-0
              `}
              onClick={() => onCryptoSelect(code)}
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
              <span className="truncate text-sm">{label}</span>
            </DropdownMenuItem>
          ) : (
            <button
              className={`
                flex min-w-0 flex-1 cursor-pointer items-center gap-2
                rounded-sm px-2 py-1.5 text-left
                text-sm
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
          )}
          <label
            className="flex shrink-0 cursor-pointer items-center gap-1.5 pl-1 pr-2"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-muted-foreground">Price</span>
            <Checkbox
              checked={pricingCryptoCodes.includes(code)}
              onCheckedChange={() => togglePricingCrypto(code)}
            />
          </label>
        </div>
      ))}
    </div>
  );
}
