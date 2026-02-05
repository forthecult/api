"use client";

import { useConnectWallet, useWallets } from "@mysten/dapp-kit";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Wallet } from "@solana/wallet-adapter-react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CHAIN_WALLET_NAMES,
  EVM_SOLANA_ONLY_WALLETS,
  tokenToChain,
} from "./chain-wallets";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";
import { cn } from "~/lib/cn";

type ConnectWalletModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "solana";
  return new URLSearchParams(window.location.search).get("token") ?? "solana";
}

const SUGGESTED_NAMES = ["Phantom", "Solflare"];

function isSuggestedWallet(wallet: Wallet, chain: string | null): boolean {
  if (chain === "solana")
    return (
      wallet.adapter.name === "Phantom" || wallet.adapter.name === "Solflare"
    );
  return SUGGESTED_NAMES.includes(wallet.adapter.name);
}

/** step 1: wallet list with "Detected" badge when extension is installed */
function WalletOption({
  wallet,
  onClick,
  disabled,
  isDetected,
}: {
  wallet: Wallet;
  onClick: () => void;
  disabled: boolean;
  isDetected: boolean;
}) {
  const icon = wallet.adapter.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
        "text-left transition-colors hover:bg-muted/50 disabled:opacity-50",
      )}
    >
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/20"
          style={{ width: 32, height: 32 }}
        >
          <img
            src={icon}
            alt=""
            className="shrink-0 object-contain"
            width={32}
            height={32}
            style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
          />
        </div>
      )}
      <span className="flex-1 font-medium">{wallet.adapter.name}</span>
      {isDetected && (
        <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
          Detected
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

const METAMASK_LOGO =
  "https://images.ctfassets.net/clixtyxoaeas/4rnpEzy1ATWRKVBOLxZ1Fm/a74dc1eed36d23d7ea6030383a4d5163/MetaMask-icon-fox.svg";

/** step 2: network selection — EVMs, Solana, Sui (screenshot-style) */
const NETWORK_OPTIONS = [
  { id: "evms", name: "EVMs", icon: "/crypto/ethereum/ethereum-logo.svg" },
  { id: "solana", name: "Solana", icon: "/crypto/solana/solanaLogoMark.svg" },
  { id: "sui", name: "Sui", icon: "/crypto/sui/sui-logo.svg" },
] as const;

const CONNECT_WAIT_MS = 120_000;

function useIsMetaMaskDetected(): boolean {
  const [detected, setDetected] = useState(false);
  useEffect(() => {
    setDetected(
      Boolean(typeof window !== "undefined" && window.ethereum?.isMetaMask),
    );
  }, []);
  return detected;
}

export function ConnectWalletModal({
  open,
  onOpenChange,
}: ConnectWalletModalProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const invoiceId = (params?.invoiceId as string) ?? "";
  const [token, setToken] = useState("solana");
  const [step, setStep] = useState<"wallet" | "network" | "requesting">(
    "wallet",
  );
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [connectingToNetwork, setConnectingToNetwork] = useState<
    "solana" | "sui" | null
  >(null);
  const isMetaMaskDetected = useIsMetaMaskDetected();
  const { wallets, select, connect, connecting, connected } = useWallet();
  const suiWallets = useWallets();
  const { mutateAsync: connectSui } = useConnectWallet();
  const connectedRef = useRef(connected);
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  connectedRef.current = connected;

  // Track the connected state when modal opens to detect new connections
  const [wasConnectedOnOpen, setWasConnectedOnOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setToken(getTokenFromUrl());
      setStep("wallet");
      setSelectedWallet(null);
      setConnectingToNetwork(null);
      setWasConnectedOnOpen(connected);
    }
  }, [open, connected]);

  // Close modal when wallet connects successfully (only if it wasn't already connected when opened)
  useEffect(() => {
    if (open && connected && !wasConnectedOnOpen && step === "requesting") {
      onOpenChange(false);
    }
  }, [open, connected, wasConnectedOnOpen, step, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setConnectingWallet(null);
      setConnectError(null);
    }
  }, [open]);

  const chain = tokenToChain(token);
  const allowedNames = chain ? CHAIN_WALLET_NAMES[chain] : [];
  const walletsToShow = wallets.filter((w) => {
    if (!allowedNames.includes(w.adapter.name)) return false;
    // only show Solflare when the wallet is detected (extension installed)
    if (w.adapter.name === "Solflare")
      return w.readyState === WalletReadyState.Installed;
    return true;
  });
  const suggested = walletsToShow.filter((w) => isSuggestedWallet(w, chain));
  const others = walletsToShow.filter((w) => !isSuggestedWallet(w, chain));

  const handleSelectWallet = useCallback((wallet: Wallet) => {
    setSelectedWallet(wallet);
    setStep("network");
  }, []);

  const handleSelectNetwork = useCallback(
    async (networkId: string) => {
      if (!selectedWallet) return;
      if (networkId === "evms") {
        onOpenChange(false);
        return;
      }
      if (networkId === "sui") {
        setConnectError(null);
        setConnectingWallet(selectedWallet.adapter.name);
        setConnectingToNetwork("sui");
        setStep("requesting");
        try {
          const walletName = selectedWallet.adapter.name;
          const suiWallet = suiWallets.find(
            (w) =>
              w.name.toLowerCase() === walletName.toLowerCase() ||
              w.name.toLowerCase().includes(walletName.toLowerCase()) ||
              walletName.toLowerCase().includes(w.name.toLowerCase()),
          );
          if (!suiWallet) {
            setConnectError(
              `${walletName} not found for Sui. Install the Sui-enabled ${walletName} extension.`,
            );
            setStep("network");
            return;
          }
          await connectSui({ wallet: suiWallet });
          onOpenChange(false);
        } catch {
          setConnectError(
            "Connection failed. Try opening your wallet manually, or refresh and try again.",
          );
          setStep("network");
        } finally {
          setConnectingWallet(null);
          setConnectingToNetwork(null);
        }
        return;
      }
      if (networkId === "solana") {
        setConnectError(null);
        setConnectingWallet(selectedWallet.adapter.name);
        setConnectingToNetwork("solana");
        setStep("requesting");
        try {
          select(selectedWallet.adapter.name);
          await new Promise((r) => setTimeout(r, 150));
          const connectPromise = connect();
          const timeoutPromise = new Promise<"timeout">((resolve) =>
            setTimeout(() => resolve("timeout"), CONNECT_WAIT_MS),
          );
          const result = await Promise.race([
            connectPromise.then(() => "ok"),
            timeoutPromise,
          ]);
          if (result === "timeout" && !connectedRef.current) {
            setConnectError(
              "Connection is taking a while. Check that the Phantom popup isn’t behind other windows, or try again.",
            );
            setStep("network");
          }
        } catch {
          setConnectError(
            "Connection failed. Try opening Phantom manually, or refresh the page and try again.",
          );
          setStep("network");
        } finally {
          setConnectingWallet(null);
          setConnectingToNetwork(null);
        }
      }
    },
    [selectedWallet, select, connect, suiWallets, connectSui, onOpenChange],
  );

  const handleBack = useCallback(() => {
    if (step === "requesting") return;
    setStep("wallet");
    setSelectedWallet(null);
    setConnectError(null);
  }, [step]);

  const isConnecting = connecting || connectingWallet !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px] gap-0 border-border bg-card p-0 sm:max-w-[400px]"
        aria-describedby={undefined}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          {(step === "network" || step === "requesting") && (
            <button
              type="button"
              onClick={handleBack}
              disabled={step === "requesting"}
              className="-ml-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
              aria-label="Back"
            >
              <ChevronRight className="size-5 rotate-180" />
            </button>
          )}
          <DialogTitle className="text-lg font-semibold">
            {step === "wallet"
              ? "Connect wallet"
              : step === "requesting"
                ? (selectedWallet?.adapter.name ?? "Phantom")
                : (selectedWallet?.adapter.name ?? "Select network")}
          </DialogTitle>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {connectError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {connectError}
            </p>
          )}

          {step === "wallet" && (
            <>
              {walletsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No wallets available for this payment method. Install a
                  supported wallet like Phantom.
                </p>
              ) : (
                <>
                  {suggested.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Suggested
                      </p>
                      <div className="flex flex-col gap-2">
                        {suggested.map((wallet) => (
                          <WalletOption
                            key={wallet.adapter.name}
                            wallet={wallet}
                            onClick={() => handleSelectWallet(wallet)}
                            disabled={isConnecting}
                            isDetected={
                              wallet.readyState === WalletReadyState.Installed
                            }
                          />
                        ))}
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
                            "text-left transition-colors hover:bg-muted/50",
                          )}
                          onClick={() => onOpenChange(false)}
                        >
                          <img
                            src={METAMASK_LOGO}
                            alt=""
                            className="size-8 shrink-0 rounded-md object-contain"
                            width={32}
                            height={32}
                          />
                          <span className="flex-1 font-medium">MetaMask</span>
                          {isMetaMaskDetected && (
                            <span className="flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                              <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                              Detected
                            </span>
                          )}
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  )}
                  {others.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Others
                      </p>
                      <div className="flex flex-col gap-2">
                        {others.map((wallet) => (
                          <WalletOption
                            key={wallet.adapter.name}
                            wallet={wallet}
                            onClick={() => handleSelectWallet(wallet)}
                            disabled={isConnecting}
                            isDetected={
                              wallet.readyState === WalletReadyState.Installed
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {step === "requesting" && selectedWallet && (
            <div className="flex flex-col items-center py-8 text-center">
              <div
                className={cn(
                  "relative mb-6 flex size-20 items-center justify-center rounded-2xl",
                  "bg-primary/5 ring-2 ring-primary/20 animate-pulse",
                )}
              >
                {selectedWallet.adapter.icon && (
                  <img
                    src={selectedWallet.adapter.icon}
                    alt=""
                    className="size-14 min-w-14 min-h-14 object-contain"
                    width={56}
                    height={56}
                  />
                )}
              </div>
              <p className="mb-2 text-lg font-semibold">
                Requesting Connection
              </p>
              <p className="max-w-[280px] text-sm text-muted-foreground">
                Open the {selectedWallet.adapter.name} browser extension to
                connect your wallet.
              </p>
            </div>
          )}

          {step === "network" && selectedWallet && (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Network
              </p>
              <div className="flex flex-col gap-2">
                {(EVM_SOLANA_ONLY_WALLETS.includes(selectedWallet.adapter.name)
                  ? NETWORK_OPTIONS.filter((n) => n.id !== "sui")
                  : NETWORK_OPTIONS
                ).map((network) =>
                  network.id === "evms" ? (
                    <div key={network.id}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
                          "text-left transition-colors hover:bg-muted/50",
                        )}
                        onClick={() => onOpenChange(false)}
                      >
                        <Image
                          src={network.icon}
                          alt=""
                          className="size-8 shrink-0 rounded-md object-contain"
                          width={32}
                          height={32}
                        />
                        <span className="flex-1 font-medium">
                          {network.name}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button
                      key={network.id}
                      type="button"
                      onClick={() => handleSelectNetwork(network.id)}
                      disabled={isConnecting}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
                        "text-left transition-colors hover:bg-muted/50 disabled:opacity-50",
                      )}
                    >
                      <Image
                        src={network.icon}
                        alt=""
                        className="size-8 shrink-0 rounded-md object-contain"
                        width={32}
                        height={32}
                      />
                      <span className="flex-1 font-medium">{network.name}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
