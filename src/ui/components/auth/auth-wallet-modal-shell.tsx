"use client";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { WagmiProvider } from "~/lib/wagmi-provider";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";

/**
 * Wraps WagmiProvider + SolanaWalletProvider + AuthWalletModal for dynamic import.
 * Loaded only when modal is opened or preloaded (e.g. on hover over header trigger).
 * WagmiProvider lives here (not in root layout) so wagmi + viem are only downloaded
 * when the user actually opens the wallet modal.
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
    <WagmiProvider>
      <SolanaWalletProvider>
        <AuthWalletModal
          onOpenChange={onOpenChange}
          open={open}
          solanaOnly={solanaOnly}
        />
      </SolanaWalletProvider>
    </WagmiProvider>
  );
}
