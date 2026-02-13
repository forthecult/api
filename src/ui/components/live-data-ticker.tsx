"use client";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

const TICKER_ITEMS = [
  "🔥 New: GrapheneOS Phones",
  "🚀 Free shipping on orders over 250 CULT",
  "🔒 Zero trackers • Your data is yours",
  "↩️ 30-day returns • Ships 2–5 days",
];

export function LiveDataTicker() {
  const { rates } = useCryptoCurrency();

  const btcUsd = rates.BTC ?? 0;
  const solUsd = rates.SOL ?? 0;
  const cultUsd = 0.00234; // Placeholder; replace with live CULT price when available
  const cultChange = "+12.3%";

  const btcDisplay =
    btcUsd > 0
      ? `$${btcUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : "—";
  const solDisplay =
    solUsd > 0
      ? `$${solUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : "—";
  const cultDisplay = `$${cultUsd.toFixed(5)}`;

  const tickerContent = (
    <>
      <span className="inline-flex items-center gap-2 font-[family-name:var(--font-mono-crypto),ui-monospace,monospace] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#14F195]" aria-hidden />
          <span>LIVE</span>
        </span>
        <span className="text-foreground">
          CULT {cultDisplay}{" "}
          <span className="text-[#14F195]">({cultChange})</span>
        </span>
        <span className="text-foreground">|</span>
        <span>BTC {btcDisplay}</span>
        <span>SOL {solDisplay}</span>
      </span>
      {TICKER_ITEMS.map((item, i) => (
        <span
          key={i}
          className="font-[family-name:var(--font-mono-crypto),ui-monospace,monospace] text-muted-foreground"
        >
          {item}
        </span>
      ))}
    </>
  );

  return (
    <div
      className="relative w-full overflow-hidden border-y border-border py-2 text-sm dark:border-[#222] dark:bg-[#0A0A0A]"
      aria-live="polite"
    >
      <div className="flex w-max hover:[animation-play-state:paused] animate-marquee-ticker gap-8 whitespace-nowrap">
        <div className="flex gap-8">{tickerContent}</div>
        <div className="flex gap-8" aria-hidden>
          {tickerContent}
        </div>
      </div>
    </div>
  );
}
