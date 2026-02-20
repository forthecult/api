"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { SolanaWalletStub } from "./solana-wallet-stub";

type SolanaProviderComponent = React.ComponentType<{ children: ReactNode }>;

function whenIdle(cb: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(cb, { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(cb, 0);
  return () => clearTimeout(t);
}

/**
 * Renders children with a stub Solana context immediately, then loads the real
 * SolanaWalletProvider after the main thread is idle (requestIdleCallback) and
 * swaps it in. Used only in the root layout for store browsing. Checkout/payment
 * page has its own real SolanaWalletProvider in the invoice layout.
 * On mobile we use a longer idle timeout so LCP (hero/brand content) can paint
 * before Solana adapters load (~339 KiB unused JS on mobile).
 *
 * always renders a provider wrapper (stub or real) so the component tree
 * structure is stable and children don't re-mount when the real provider loads.
 */
export function LazySolanaWalletProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<SolanaProviderComponent>(
    () => SolanaWalletStub,
  );

  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    const timeoutMs = isMobile ? 4000 : 2500;
    return whenIdle(() => {
      import("./SolanaWalletProvider").then((mod) => {
        setProvider(() => mod.SolanaWalletProvider);
      });
    }, timeoutMs);
  }, []);

  return <Provider>{children}</Provider>;
}
