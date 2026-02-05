"use client";

import { useCallback, useEffect, useState } from "react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import {
  AuthWalletModal,
  OPEN_LINK_WALLET_MODAL,
} from "~/ui/components/auth/auth-wallet-modal";

export function DashboardWalletLinkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setLinkModalOpen(true);
    window.addEventListener(OPEN_LINK_WALLET_MODAL, handleOpen);
    return () => window.removeEventListener(OPEN_LINK_WALLET_MODAL, handleOpen);
  }, []);

  return (
    <SolanaWalletProvider>
      {children}
      <AuthWalletModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        link
      />
    </SolanaWalletProvider>
  );
}
