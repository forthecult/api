"use client";

import { Loader2 } from "lucide-react";

import { useSolanaReady } from "~/app/checkout/crypto/lazy-solana-wallet-provider";
import { useWagmiReady } from "~/lib/lazy-wagmi-provider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";

/**
 * Shell for AuthWalletModal, loaded via dynamic import.
 * Root uses LazyWagmiProvider and LazySolanaWalletProvider; both load when
 * this modal is opened/preloaded. Show loading until both are ready so we
 * never render wallet hooks without the providers.
 *
 * Note: This shell does NOT wrap in SolanaWalletProvider because it's already
 * inside LazySolanaWalletProvider from the root layout. Using the same context
 * ensures wallet connections in the modal are visible to the rest of the app.
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
  const wagmiReady = useWagmiReady();
  const solanaReady = useSolanaReady();

  if (!open) return null;

  // wait for both providers to be ready before showing wallet options
  const isReady = solanaOnly ? solanaReady : wagmiReady && solanaReady;

  if (!isReady) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="flex min-h-[200px] items-center justify-center">
          <DialogTitle className="sr-only">Connect wallet</DialogTitle>
          <Loader2 aria-hidden className="h-8 w-8 animate-spin text-muted-foreground" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AuthWalletModal
      connectOnly={solanaOnly}
      onOpenChange={onOpenChange}
      open={open}
      solanaOnly={solanaOnly}
    />
  );
}
