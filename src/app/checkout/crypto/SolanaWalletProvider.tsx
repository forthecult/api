"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { toast } from "sonner";

import { getSolanaRpcUrl, isPublicSolanaRpc } from "~/lib/solana-pay";

// Expected Solana cluster for mainnet
const EXPECTED_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

/**
 * Network validator component - checks we're connected to mainnet.
 * Only validates when a wallet is actually connected (avoids blocking
 * the QR code flow with RPC calls that may fail or slow down page load).
 */
function NetworkValidator({
  children,
  rpcEndpoint,
}: { children: React.ReactNode; rpcEndpoint: string }) {
  const { connection } = useConnection();
  const { connected } = useWallet();
  const [isValidNetwork, setIsValidNetwork] = useState(true);

  useEffect(() => {
    // Only validate when a wallet is connected — QR code flow doesn't need RPC
    if (!connected || isPublicSolanaRpc(rpcEndpoint)) return;
    let cancelled = false;

    (async () => {
      try {
        const genesisHash = await connection.getGenesisHash();
        if (cancelled) return;
        if (genesisHash !== EXPECTED_GENESIS_HASH) {
          setIsValidNetwork(false);
          toast.error(
            "Wrong Solana network detected. Please switch to Mainnet.",
          );
        } else {
          setIsValidNetwork(true);
        }
      } catch {
        // RPC errors are non-fatal — assume correct network
        if (!cancelled) setIsValidNetwork(true);
      }
    })();

    return () => { cancelled = true; };
  }, [connection, connected, rpcEndpoint]);

  if (!isValidNetwork) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p className="font-medium text-destructive">
          Wrong Solana Network Detected
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Please switch your wallet to Solana Mainnet to continue.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Solana wallet provider with network validation.
 * We pass only Solflare explicitly; WalletProvider also merges in Standard Wallets
 * (Phantom, Trust, etc.), so we avoid duplicate registration and "Standard Wallet"
 * console warnings.
 */
export function SolanaWalletProvider({
  children,
}: { children: React.ReactNode }) {
  // Get RPC endpoint from config (ANKR default; override via NEXT_PUBLIC_SOLANA_RPC_URL)
  const rpcEndpoint = useMemo(() => getSolanaRpcUrl(), []);

  const wallets = useMemo(
    () => [new SolflareWalletAdapter()],
    [],
  );

  // Error handler for wallet connection issues
  const onError = useCallback((error: Error) => {
    console.error("[Solana Wallet]", error);
    toast.error(error.message || "Wallet connection error");
  }, []);

  return (
    <ConnectionProvider
      endpoint={rpcEndpoint}
      config={{
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      }}
    >
      <WalletProvider wallets={wallets} autoConnect={false} onError={onError}>
        <NetworkValidator rpcEndpoint={rpcEndpoint}>
          {children}
        </NetworkValidator>
      </WalletProvider>
    </ConnectionProvider>
  );
}
