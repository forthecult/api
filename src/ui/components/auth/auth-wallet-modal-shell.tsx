"use client";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";

/**
 * Wraps SolanaWalletProvider + AuthWalletModal for dynamic import.
 * Loaded only when modal is opened or preloaded (e.g. on hover over header trigger).
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
