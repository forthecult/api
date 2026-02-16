"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";

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
 * Wraps children with WagmiProvider only after the auth/wallet modal is
 * opened or preloaded (e.g. hover on "Connect wallet"). Keeps Wagmi + viem
 * out of the initial bundle for faster first load.
 */
export function LazyWagmiProvider({ children }: { children: ReactNode }) {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null);
  const loadingRef = React.useRef(false);

  const loadWagmi = useCallback(() => {
    if (Provider != null || loadingRef.current) return;
    loadingRef.current = true;
    import("~/lib/wagmi-provider").then((m) => {
      setProvider(() => m.WagmiProvider);
    });
  }, [Provider]);

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

  if (Provider == null) {
    return (
      <WagmiReadyContext.Provider value={false}>
        {children}
      </WagmiReadyContext.Provider>
    );
  }

  return (
    <WagmiReadyContext.Provider value={true}>
      <Provider>{children}</Provider>
    </WagmiReadyContext.Provider>
  );
}
