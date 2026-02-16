"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { WagmiProvider } from "~/lib/wagmi-provider";
import { OPEN_LINK_WALLET_MODAL } from "~/ui/components/auth/auth-wallet-modal-events";

// Lazy-load AuthWalletModal so wagmi + wallet adapter code only downloads when
// the user opens the link-wallet modal, not on every dashboard page load.
const AuthWalletModal = dynamic(
  () =>
    import("~/ui/components/auth/auth-wallet-modal").then(
      (m) => m.AuthWalletModal,
    ),
  { ssr: false },
);

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

  // WagmiProvider is needed for AuthWalletModal's wagmi hooks (useAccount,
  // useConnect, etc.). It lives here (not in root layout) so wagmi + viem are
  // only loaded on dashboard pages, not every page.
  return (
    <WagmiProvider>
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
    </WagmiProvider>
  );
}
