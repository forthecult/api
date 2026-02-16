"use client";

import { createContext, use } from "react";

export const OPEN_CONNECT_WALLET_MODAL = "open-connect-wallet-modal";

/** ref set by layout so header (including portal content) can open the modal without relying on context */
export const openModalRef: { current: (() => void) | null } = { current: null };

/** When 'add-wallet', ConnectWalletModal will not auto-close for already-connected state (so user can add another wallet). */
export const openIntentRef: {
  current: "add-wallet" | "connect";
} = { current: "connect" };

interface OpenConnectWalletModalContextValue {
  openModal: () => void;
}

export function openConnectWalletModal(options?: {
  intent?: "add-wallet" | "connect";
}): void {
  openIntentRef.current = options?.intent === "add-wallet" ? "add-wallet" : "connect";
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_CONNECT_WALLET_MODAL));
  }
  openModalRef.current?.();
}

const OpenConnectWalletModalContext =
  createContext<null | OpenConnectWalletModalContextValue>(null);

export function OpenConnectWalletModalProvider({
  children,
  openModal,
}: {
  children: React.ReactNode;
  openModal: () => void;
}) {
  return (
    <OpenConnectWalletModalContext value={{ openModal }}>
      {children}
    </OpenConnectWalletModalContext>
  );
}

export function useOpenConnectWalletModal(): (() => void) | null {
  try {
    const ctx = use(OpenConnectWalletModalContext);
    return ctx?.openModal ?? null;
  } catch {
    // Can happen with duplicate React or when dispatcher is null (e.g. wrong React instance)
    return null;
  }
}
