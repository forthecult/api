"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import {
  OPEN_AUTH_WALLET_MODAL,
  OPEN_SOLANA_WALLET_MODAL,
  PRELOAD_AUTH_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal-events";

const AuthWalletModalShell = dynamic(
  () =>
    import("~/ui/components/auth/auth-wallet-modal-shell").then(
      (m) => m.AuthWalletModalShell,
    ),
  { ssr: false },
);

/**
 * Listens for wallet modal events and lazy-loads the modal (and Solana provider)
 * only when opened or when PRELOAD_AUTH_WALLET_MODAL is fired (e.g. on hover
 * over the header profile/wallet area). Keeps the initial bundle smaller.
 */
export function AuthWalletModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [solanaOnly, setSolanaOnly] = useState(false);
  const [preload, setPreload] = useState(false);

  const handleOpen = useCallback(() => {
    setSolanaOnly(false);
    setOpen(true);
  }, []);

  const handleOpenSolana = useCallback(() => {
    setSolanaOnly(true);
    setOpen(true);
  }, []);

  const handlePreload = useCallback(() => setPreload(true), []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setSolanaOnly(false);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_AUTH_WALLET_MODAL, handleOpen);
    window.addEventListener(OPEN_SOLANA_WALLET_MODAL, handleOpenSolana);
    window.addEventListener(PRELOAD_AUTH_WALLET_MODAL, handlePreload);
    return () => {
      window.removeEventListener(OPEN_AUTH_WALLET_MODAL, handleOpen);
      window.removeEventListener(OPEN_SOLANA_WALLET_MODAL, handleOpenSolana);
      window.removeEventListener(PRELOAD_AUTH_WALLET_MODAL, handlePreload);
    };
  }, [handleOpen, handleOpenSolana, handlePreload]);

  const showModal = open || preload;

  return (
    <>
      {children}
      {showModal && (
        <AuthWalletModalShell
          onOpenChange={handleOpenChange}
          open={open}
          solanaOnly={solanaOnly}
        />
      )}
    </>
  );
}
