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
 * SolanaWalletProvider after the main thread is idle and swaps it in. Reduces
 * initial JS by deferring the Solana adapter chunk (Phantom, Solflare, etc.).
 */
export function LazySolanaWalletProvider({ children }: { children: ReactNode }) {
  const [RealProvider, setRealProvider] = useState<SolanaProviderComponent | null>(null);

  useEffect(() => {
    return whenIdle(() => {
      import("./SolanaWalletProvider").then((mod) => {
        setRealProvider(() => mod.SolanaWalletProvider);
      });
    }, 1500);
  }, []);

  if (RealProvider) {
    const P = RealProvider;
    return <P>{children}</P>;
  }

  return <SolanaWalletStub>{children}</SolanaWalletStub>;
}
