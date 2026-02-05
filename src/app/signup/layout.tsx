"use client";

import { useCallback, useEffect, useState } from "react";

import { ConnectWalletModal } from "~/app/checkout/crypto/ConnectWalletModal";
import {
  OPEN_CONNECT_WALLET_MODAL,
  openModalRef,
  OpenConnectWalletModalProvider,
} from "~/app/checkout/crypto/open-wallet-modal";
import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { SuiWalletProvider } from "~/app/checkout/crypto/SuiWalletProvider";
import {
  AuthWalletModal,
  OPEN_AUTH_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal";

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [authWalletOpen, setAuthWalletOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);

  useEffect(() => {
    openModalRef.current = () => setOpen(true);
    return () => {
      openModalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_CONNECT_WALLET_MODAL, handleOpen);
    return () =>
      window.removeEventListener(OPEN_CONNECT_WALLET_MODAL, handleOpen);
  }, []);

  useEffect(() => {
    const handleAuthWallet = () => setAuthWalletOpen(true);
    window.addEventListener(OPEN_AUTH_WALLET_MODAL, handleAuthWallet);
    return () =>
      window.removeEventListener(OPEN_AUTH_WALLET_MODAL, handleAuthWallet);
  }, []);

  return (
    <OpenConnectWalletModalProvider openModal={openModal}>
      <SuiWalletProvider>
        <SolanaWalletProvider>
          {children}
          <ConnectWalletModal open={open} onOpenChange={setOpen} />
          <AuthWalletModal
            open={authWalletOpen}
            onOpenChange={setAuthWalletOpen}
          />
        </SolanaWalletProvider>
      </SuiWalletProvider>
    </OpenConnectWalletModalProvider>
  );
}
