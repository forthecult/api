"use client";

import { useEffect, useState } from "react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";
import { OPEN_LINK_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal-events";

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
      {linkModalOpen && (
        <AuthWalletModal
          link
          onOpenChange={setLinkModalOpen}
          open={linkModalOpen}
        />
      )}
    </SolanaWalletProvider>
  );
}
