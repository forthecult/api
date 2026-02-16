"use client";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";

/**
 * Wraps SolanaWalletProvider + AuthWalletModal for dynamic import.
 * WagmiProvider is in root layout; this shell is loaded when the modal opens.
 */
export function AuthWalletModalShell({
  onOpenChange,
  open,
  solanaOnly,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  solanaOnly: boolean;
}) {
  return (
    <SolanaWalletProvider>
      <AuthWalletModal
        onOpenChange={onOpenChange}
        open={open}
        solanaOnly={solanaOnly}
      />
    </SolanaWalletProvider>
  );
}
