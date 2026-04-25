"use client";

import {
  type WalletAdapter,
  WalletAdapterNetwork,
} from "@solana/wallet-adapter-base";
import {
  ConnectionContext,
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletContext,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  SolflareWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useIsMobile } from "~/lib/hooks/use-mobile";
import { getSolanaRpcUrl, isPublicSolanaRpc } from "~/lib/solana-pay";

// Expected Solana cluster for mainnet
const EXPECTED_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

/**
 * Solana wallet provider with network validation.
 * We pass Solflare; on mobile only we dynamically import and add the Mobile Wallet Adapter (MWA)
 * so the @solana-mobile chunk is never loaded on desktop.
 * WalletProvider also merges in Standard Wallets (Phantom, Trust, etc.).
 */
export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  // Get RPC endpoint from config (ANKR default; override via NEXT_PUBLIC_SOLANA_RPC_URL)
  const rpcEndpoint = useMemo(() => getSolanaRpcUrl(), []);

  // Phantom via Wallet Standard only — do not add PhantomWalletAdapter (duplicate registration breaks extensions).
  const baseWallets = useMemo((): WalletAdapter[] => {
    const list: WalletAdapter[] = [new SolflareWalletAdapter()];
    const wcEnabled =
      process.env.NEXT_PUBLIC_SOLANA_WALLETCONNECT_ENABLED !== "false";
    const wcProjectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
    if (wcEnabled && wcProjectId) {
      try {
        list.push(
          new WalletConnectWalletAdapter({
            network: WalletAdapterNetwork.Mainnet,
            options: {
              projectId: wcProjectId,
              telemetryEnabled: false,
            },
          }),
        );
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Solana] WalletConnect adapter init failed", e);
        }
      }
    }
    return list;
  }, []);

  // load @solana-mobile only on mobile (dynamic import = separate chunk, never requested on desktop)
  const [mobileAdapter, setMobileAdapter] = useState<null | WalletAdapter>(
    null,
  );
  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return;
    import("@solana-mobile/wallet-adapter-mobile")
      .then((mobile) => {
        setMobileAdapter(
          new mobile.SolanaMobileWalletAdapter({
            addressSelector: mobile.createDefaultAddressSelector(),
            appIdentity: {
              icon: `${window.location.origin}/favicon.ico`,
              name: "For the Cult",
              uri: window.location.origin,
            },
            authorizationResultCache:
              mobile.createDefaultAuthorizationResultCache(),
            chain: "solana:mainnet",
            onWalletNotFound: mobile.createDefaultWalletNotFoundHandler(),
          }),
        );
      })
      .catch((e) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[Solana] Mobile Wallet Adapter not available", e);
        }
      });
  }, [isMobile]);

  const wallets = useMemo(
    () => (mobileAdapter ? [...baseWallets, mobileAdapter] : baseWallets),
    [baseWallets, mobileAdapter],
  );

  // Error handler for wallet connection issues
  const onError = useCallback((error: Error) => {
    console.error("[Solana Wallet]", error);
    toast.error(error.message || "Wallet connection error");
  }, []);

  // so useSolanaWallet/useSolanaConnection in the stub file can read real context when this provider is mounted
  useEffect(() => {
    if (typeof window !== "undefined") {
      (
        window as unknown as { __SOLANA_WALLET_CONTEXT?: typeof WalletContext }
      ).__SOLANA_WALLET_CONTEXT = WalletContext;
      (
        window as unknown as {
          __SOLANA_CONNECTION_CONTEXT?: typeof ConnectionContext;
        }
      ).__SOLANA_CONNECTION_CONTEXT = ConnectionContext;
    }
  }, []);

  return (
    <ConnectionProvider
      config={{
        commitment: "confirmed",
        confirmTransactionInitialTimeout: 60000,
      }}
      endpoint={rpcEndpoint}
    >
      <WalletProvider autoConnect={false} onError={onError} wallets={wallets}>
        <NetworkValidator rpcEndpoint={rpcEndpoint}>
          {children}
        </NetworkValidator>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * Network validator component - checks we're connected to mainnet.
 * Only validates when a wallet is actually connected (avoids blocking
 * the QR code flow with RPC calls that may fail or slow down page load).
 */
function NetworkValidator({
  children,
  rpcEndpoint,
}: {
  children: React.ReactNode;
  rpcEndpoint: string;
}) {
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

    return () => {
      cancelled = true;
    };
  }, [connection, connected, rpcEndpoint]);

  if (!isValidNetwork) {
    return (
      <div
        className={`
          rounded-lg border border-destructive/50 bg-destructive/10 p-4
          text-center
        `}
      >
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
