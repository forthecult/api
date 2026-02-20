"use client";

import { Loader2 } from "lucide-react";

import { SolanaWalletProvider } from "~/app/checkout/crypto/SolanaWalletProvider";
import { useWagmiReady } from "~/lib/lazy-wagmi-provider";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { AuthWalletModal } from "~/ui/components/auth/auth-wallet-modal";

/**
 * Wraps SolanaWalletProvider + AuthWalletModal for dynamic import.
 * Root uses LazyWagmiProvider; Wagmi loads when this modal is opened/preloaded.
 * Show loading until Wagmi is ready so we never render wallet hooks without the provider.
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

  if (!open) return null;

  if (!wagmiReady) {
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
    <SolanaWalletProvider>
      <AuthWalletModal
        connectOnly={solanaOnly}
        onOpenChange={onOpenChange}
        open={open}
        solanaOnly={solanaOnly}
      />
    </SolanaWalletProvider>
  );
}
