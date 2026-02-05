"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
} from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { toast } from "sonner";

import { getSolanaRpcUrl, isPublicSolanaRpc } from "~/lib/solana-pay";

// Expected Solana cluster for mainnet
const EXPECTED_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

/**
 * Network validator component - checks we're connected to mainnet.
 * Skips the RPC call when using the public Solana RPC (avoids 403 console noise).
 */
function NetworkValidator({
  children,
  rpcEndpoint,
}: { children: React.ReactNode; rpcEndpoint: string }) {
  const { connection } = useConnection();
  const [isValidNetwork, setIsValidNetwork] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isPublicSolanaRpc(rpcEndpoint)) {
      setIsChecking(false);
      return;
    }
    let cancelled = false;

    const validateNetwork = async () => {
      try {
        setIsChecking(true);
        const genesisHash = await connection.getGenesisHash();

        if (cancelled) return;

        if (genesisHash !== EXPECTED_GENESIS_HASH) {
          console.error(
            `[Solana] Wrong network. Expected mainnet (${EXPECTED_GENESIS_HASH}), got ${genesisHash}`,
          );
          setIsValidNetwork(false);
          toast.error(
            "Wrong Solana network detected. Please switch to Mainnet.",
          );
        } else {
          setIsValidNetwork(true);
        }
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : String(error);
        const isForbidden =
          msg.includes("403") ||
          msg.includes("Access forbidden") ||
          msg.includes("Forbidden");
        if (!isForbidden) {
          console.error("[Solana] Failed to validate network:", error);
        }
        setIsValidNetwork(true);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    validateNetwork();
    return () => {
      cancelled = true;
    };
  }, [connection, rpcEndpoint]);

  if (isChecking) {
    return <>{children}</>;
  }

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
