"use client";

import { Bitcoin } from "lucide-react";
import { useState } from "react";

import {
  type CryptoCode,
  MAX_PRICING_CRYPTO_LINES,
  useCryptoCurrency,
} from "~/lib/hooks/use-crypto-currency";
import { CryptoPricingTogglesList } from "~/ui/components/crypto-pricing-toggles-list";
import { Button } from "~/ui/primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";

/**
 * Same “up to 2” crypto price lines as the footer, without scrolling away from PDP / cards.
 */
export function CryptoPricingSettingsPopover({
  align = "end",
  className = "",
  compact = false,
}: {
  align?: "center" | "end" | "start";
  className?: string;
  /** Icon-only control for dense layouts (e.g. product card). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { setSelectedCrypto } = useCryptoCurrency();
  return (
    <div className={className}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          {compact ? (
            <Button
              aria-expanded={open}
              aria-label="Choose which cryptos show product prices (up to 2)"
              className="h-7 w-7 shrink-0 p-0"
              type="button"
              variant="ghost"
            >
              <Bitcoin className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          ) : (
            <Button
              className={`
                h-auto shrink-0 px-0 py-0 text-xs text-muted-foreground
              `}
              type="button"
              variant="link"
            >
              Crypto price display
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent align={align} className="w-[min(100vw-2rem,26rem)] p-0">
          <p
            className={`
              border-b border-border px-3 py-2 text-xs text-muted-foreground
            `}
            id="crypto-pricing-hint"
          >
            Check up to {String(MAX_PRICING_CRYPTO_LINES)} cryptos (right
            column) for stacked price lines here, in the footer, and in quick
            view. Tap the left column to set the footer spot ticker.
          </p>
          <div className="max-h-64 overflow-y-auto">
            <CryptoPricingTogglesList
              onCryptoSelect={(code: CryptoCode) => {
                setSelectedCrypto(code);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
