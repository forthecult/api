"use client";

import { useCallback, useEffect, useState } from "react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import {
  AuthWalletModal,
  OPEN_AUTH_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal";

/**
 * Renders AuthWalletModal and listens for OPEN_AUTH_WALLET_MODAL so that
 * "Connect Wallet" in the header (and anywhere else) can open the sign-in
 * modal without navigating to /login. Must wrap children with SolanaWalletProvider
 * so the modal has access to useWallet().
 */
export function AuthWalletModalProvider({
  children,
}: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const handler = () => handleOpen();
    window.addEventListener(OPEN_AUTH_WALLET_MODAL, handler);
    return () => window.removeEventListener(OPEN_AUTH_WALLET_MODAL, handler);
  }, [handleOpen]);

  return (
    <SolanaWalletProvider>
      {children}
      <AuthWalletModal open={open} onOpenChange={setOpen} />
    </SolanaWalletProvider>
  );
}
