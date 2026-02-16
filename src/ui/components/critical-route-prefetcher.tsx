"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Prefetches /products only. Keeps deferred prefetch small to avoid loading
 * heavy checkout/crypto chunks on every page (mobile LCP and unused JS).
 * Checkout is prefetched on intent (cart open, checkout link hover) in
 * prefetch-checkout.ts.
 */
export function CriticalRoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/products");
  }, [router]);

  return null;
}
