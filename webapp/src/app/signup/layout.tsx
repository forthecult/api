"use client";

import { useCallback, useEffect, useState } from "react";

import { ConnectWalletModal } from "~/app/checkout/crypto/ConnectWalletModal";
import {
  OPEN_CONNECT_WALLET_MODAL,
  OpenConnectWalletModalProvider,
  openModalRef,
} from "~/app/checkout/crypto/open-wallet-modal";
import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { SuiWalletProvider } from "~/app/checkout/crypto/SuiWalletProvider";

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
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

  // Note: AuthWalletModal is provided by AuthWalletModalProvider in root layout
  // Don't add another one here to avoid duplicate modals

  return (
    <OpenConnectWalletModalProvider openModal={openModal}>
      <SuiWalletProvider>
        <SolanaWalletProvider>
          {children}
          <ConnectWalletModal onOpenChange={setOpen} open={open} />
        </SolanaWalletProvider>
      </SuiWalletProvider>
    </OpenConnectWalletModalProvider>
  );
}
