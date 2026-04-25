"use client";

import type { ComponentType, ReactNode } from "react";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  OPEN_AUTH_WALLET_MODAL,
  OPEN_LINK_WALLET_MODAL,
  OPEN_SOLANA_WALLET_MODAL,
  PRELOAD_AUTH_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal-events";

type ProviderComponent = ComponentType<{ children: ReactNode }>;

/** True when the Wagmi provider chunk has loaded and is mounted. */
export const WagmiReadyContext = React.createContext(false);

function useWagmiReady() {
  return React.useContext(WagmiReadyContext);
}

export { useWagmiReady };

/**
 * Stable shell component that wraps children. Uses a ref to track the loaded
 * provider and renders children through it. The shell component itself never
 * changes, preventing React from remounting children when the provider loads.
 */
const ProviderShell = React.memo(function ProviderShell({
  children,
  providerRef,
  version: _version,
}: {
  children: ReactNode;
  providerRef: React.RefObject<null | ProviderComponent>;
  version: number;
}) {
  const Provider = providerRef.current;
  if (Provider) {
    return <Provider>{children}</Provider>;
  }
  return <>{children}</>;
});

/**
 * Wraps children with WagmiProvider only after the auth/wallet modal is
 * opened or preloaded (e.g. hover on "Connect wallet"). Keeps Wagmi + viem
 * out of the initial bundle for faster first load.
 *
 * Uses a stable shell component so children don't re-mount when Wagmi loads.
 */
export function LazyWagmiProvider({ children }: { children: ReactNode }) {
  const providerRef = useRef<null | ProviderComponent>(null);
  const [isReady, setIsReady] = useState(false);
  const [version, setVersion] = useState(0);
  const loadingRef = useRef(false);

  const loadWagmi = useCallback(() => {
    if (isReady || loadingRef.current) return;
    loadingRef.current = true;
    import("~/lib/wagmi-provider").then((m) => {
      providerRef.current = m.WagmiProvider;
      setIsReady(true);
      setVersion((v) => v + 1);
    });
  }, [isReady]);

  useEffect(() => {
    const onTrigger = () => loadWagmi();
    window.addEventListener(PRELOAD_AUTH_WALLET_MODAL, onTrigger);
    window.addEventListener(OPEN_AUTH_WALLET_MODAL, onTrigger);
    window.addEventListener(OPEN_SOLANA_WALLET_MODAL, onTrigger);
    window.addEventListener(OPEN_LINK_WALLET_MODAL, onTrigger);
    return () => {
      window.removeEventListener(PRELOAD_AUTH_WALLET_MODAL, onTrigger);
      window.removeEventListener(OPEN_AUTH_WALLET_MODAL, onTrigger);
      window.removeEventListener(OPEN_SOLANA_WALLET_MODAL, onTrigger);
      window.removeEventListener(OPEN_LINK_WALLET_MODAL, onTrigger);
    };
  }, [loadWagmi]);

  return (
    <WagmiReadyContext.Provider value={isReady}>
      <ProviderShell providerRef={providerRef} version={version}>
        {children}
      </ProviderShell>
    </WagmiReadyContext.Provider>
  );
}
