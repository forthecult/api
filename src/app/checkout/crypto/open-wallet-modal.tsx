"use client";

import { createContext, useContext } from "react";

export const OPEN_CONNECT_WALLET_MODAL = "open-connect-wallet-modal";

/** ref set by layout so header (including portal content) can open the modal without relying on context */
export const openModalRef: { current: (() => void) | null } = { current: null };

export function openConnectWalletModal(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_CONNECT_WALLET_MODAL));
  }
  openModalRef.current?.();
}

type OpenConnectWalletModalContextValue = {
  openModal: () => void;
};

const OpenConnectWalletModalContext =
  createContext<OpenConnectWalletModalContextValue | null>(null);

export function OpenConnectWalletModalProvider({
  children,
  openModal,
}: {
  children: React.ReactNode;
  openModal: () => void;
}) {
  return (
    <OpenConnectWalletModalContext.Provider value={{ openModal }}>
      {children}
    </OpenConnectWalletModalContext.Provider>
  );
}

export function useOpenConnectWalletModal(): (() => void) | null {
  try {
    const ctx = useContext(OpenConnectWalletModalContext);
    return ctx?.openModal ?? null;
  } catch {
    // Can happen with duplicate React or when dispatcher is null (e.g. wrong React instance)
    return null;
  }
}
