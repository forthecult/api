"use client";

import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";
import { cn } from "~/lib/cn";

/**
 * When DOGE is selected, the footer shows a doge peek image that overlaps
 * content above. This wrapper adds bottom padding so product CTAs etc.
 * are not covered (mobile especially).
 */
export function MainWithDogePadding({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { selectedCrypto } = useCryptoCurrency();
  const isDoge = selectedCrypto === "DOGE";

  return (
    <div
      className={cn(
        className,
        isDoge && "pb-44 sm:pb-48",
      )}
    >
      {children}
    </div>
  );
}
