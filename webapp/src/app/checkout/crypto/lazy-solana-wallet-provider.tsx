"use client";

import type { ReactNode } from "react";

import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { whenIdle } from "~/lib/when-idle";
import { PRELOAD_SOLANA_WALLET } from "~/ui/components/auth/auth-wallet-modal-events";

import { SolanaWalletStub } from "./solana-wallet-stub";

type SolanaProviderComponent = React.ComponentType<{ children: ReactNode }>;

/** True when the real Solana wallet provider has loaded (not the stub). */
export const SolanaReadyContext = React.createContext(false);

export function useSolanaReady() {
  return useContext(SolanaReadyContext);
}

/**
 * Stable shell component that wraps children. Uses a ref to track the loaded
 * provider and renders children through it. The shell component itself never
 * changes identity, minimizing React reconciliation of children.
 */
const ProviderShell = memo(function ProviderShell({
  children,
  providerRef,
  version: _version,
}: {
  children: ReactNode;
  providerRef: React.RefObject<null | SolanaProviderComponent>;
  version: number;
}) {
  const Provider = providerRef.current ?? SolanaWalletStub;
  return <Provider>{children}</Provider>;
});

/**
 * Renders children with a stub Solana context immediately, then loads the real
 * SolanaWalletProvider after the main thread is idle (requestIdleCallback) and
 * swaps it in. Used only in the root layout for store browsing. Checkout/payment
 * page has its own real SolanaWalletProvider in the invoice layout.
 * On mobile we use a longer idle timeout so LCP (hero/brand content) can paint
 * before Solana adapters load (~339 KiB unused JS on mobile).
 *
 * Uses a stable shell component to minimize child remounts when provider loads.
 * Also listens for PRELOAD_SOLANA_WALLET event to trigger immediate loading.
 */
export function LazySolanaWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const providerRef = useRef<null | SolanaProviderComponent>(null);
  const [isReady, setIsReady] = useState(false);
  const [version, setVersion] = useState(0);
  const loadingRef = useRef(false);

  const loadProvider = useCallback(() => {
    if (providerRef.current || loadingRef.current) return;
    loadingRef.current = true;
    import("./SolanaWalletProvider").then((mod) => {
      providerRef.current = mod.SolanaWalletProvider;
      setIsReady(true);
      setVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches;
    const timeoutMs = isMobile ? 4000 : 2500;

    // immediate load on preload event
    const onPreload = () => loadProvider();
    window.addEventListener(PRELOAD_SOLANA_WALLET, onPreload);

    // also load after idle timeout
    const cleanup = whenIdle(loadProvider, timeoutMs);
    return () => {
      cleanup();
      window.removeEventListener(PRELOAD_SOLANA_WALLET, onPreload);
    };
  }, [loadProvider]);

  return (
    <SolanaReadyContext.Provider value={isReady}>
      <ProviderShell providerRef={providerRef} version={version}>
        {children}
      </ProviderShell>
    </SolanaReadyContext.Provider>
  );
}
