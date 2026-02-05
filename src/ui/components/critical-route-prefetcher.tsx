"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Eagerly prefetches critical routes as soon as the app is interactive,
 * so navigation to checkout/products feels instant instead of waiting for
 * viewport-based prefetch or full route load on first click.
 */
export function CriticalRoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/checkout");
    router.prefetch("/products");
  }, [router]);

  return null;
}
