"use client";

import * as React from "react";

import { useSession } from "~/lib/auth-client";
import { useCart } from "~/lib/hooks/use-cart";

const DEBOUNCE_MS = 1200;

/**
 * Syncs the in-memory cart to the server (signed-in only) so abandon-cart cron
 * can detect idle carts. Debounced to avoid spamming the API on rapid quantity edits.
 */
export function CartMarketingSync() {
  const { data: sessionData } = useSession();
  const { isHydrated, items, subtotal } = useCart();
  const userId = sessionData?.user?.id;

  React.useEffect(() => {
    if (!isHydrated || !userId) return;

    const subtotalCents = Math.round(subtotal * 100);
    const handle = window.setTimeout(() => {
      const payload = JSON.stringify({
        items:
          items.length === 0 ?
            []
          : items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              productId: i.productId,
              productVariantId: i.productVariantId,
              quantity: i.quantity,
            })),
        subtotalCents,
      });

      void fetch("/api/cart/snapshot", {
        body: payload,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        method: "POST",
      }).catch(() => {
        /* optional sync */
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [isHydrated, items, subtotal, userId]);

  React.useEffect(() => {
    if (!isHydrated || !userId) return;

    const flush = () => {
      const subtotalCents = Math.round(subtotal * 100);
      const payload = JSON.stringify({
        items:
          items.length === 0 ?
            []
          : items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              productId: i.productId,
              productVariantId: i.productVariantId,
              quantity: i.quantity,
            })),
        subtotalCents,
      });
      void navigator.sendBeacon(
        "/api/cart/snapshot",
        new Blob([payload], { type: "application/json" }),
      );
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [isHydrated, items, subtotal, userId]);

  return null;
}
