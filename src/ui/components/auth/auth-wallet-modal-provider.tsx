"use client";

import { useCallback, useEffect, useState } from "react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import {
  AuthWalletModal,
  OPEN_AUTH_WALLET_MODAL,
  OPEN_SOLANA_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal";

/**
 * Renders AuthWalletModal and listens for OPEN_AUTH_WALLET_MODAL so that
 * "Connect Wallet" in the header (and anywhere else) can open the sign-in
 * modal without navigating to /login. Must wrap children with SolanaWalletProvider
 * so the modal has access to useWallet().
 *
 * Also listens for OPEN_SOLANA_WALLET_MODAL to open in Solana-only mode
 * (used by the membership staking flow).
 */
export function AuthWalletModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [solanaOnly, setSolanaOnly] = useState(false);

  const handleOpen = useCallback(() => {
    setSolanaOnly(false);
    setOpen(true);
  }, []);

  const handleOpenSolana = useCallback(() => {
    setSolanaOnly(true);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setSolanaOnly(false);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_AUTH_WALLET_MODAL, handleOpen);
    window.addEventListener(OPEN_SOLANA_WALLET_MODAL, handleOpenSolana);
    return () => {
      window.removeEventListener(OPEN_AUTH_WALLET_MODAL, handleOpen);
      window.removeEventListener(OPEN_SOLANA_WALLET_MODAL, handleOpenSolana);
    };
  }, [handleOpen, handleOpenSolana]);

  return (
    <SolanaWalletProvider>
      {children}
      <AuthWalletModal
        open={open}
        onOpenChange={handleOpenChange}
        solanaOnly={solanaOnly}
      />
    </SolanaWalletProvider>
  );
}
