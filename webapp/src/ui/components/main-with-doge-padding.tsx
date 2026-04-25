"use client";

import { usePathname } from "next/navigation";

import { cn } from "~/lib/cn";
import { useCryptoCurrency } from "~/lib/hooks/use-crypto-currency";

/**
 * When DOGE is selected, the footer shows a doge peek image that overlaps
 * content above. This wrapper adds bottom padding so product CTAs etc.
 * are not covered (mobile especially). On /chat there is no footer, so
 * padding is skipped to avoid extra page scroll.
 */
export function MainWithDogePadding({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const { selectedCrypto } = useCryptoCurrency();
  const isDoge = selectedCrypto === "DOGE";
  const skipFooterOverlapPadding = pathname === "/chat";

  return (
    <div
      className={cn(
        className,
        isDoge &&
          !skipFooterOverlapPadding &&
          `
            pb-44
            sm:pb-48
          `,
      )}
    >
      {children}
    </div>
  );
}
