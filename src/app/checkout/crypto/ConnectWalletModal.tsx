"use client";

import type { Wallet } from "@solana/wallet-adapter-react";

import { useConnectWallet, useWallets } from "@mysten/dapp-kit";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { useIsMobile } from "~/lib/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";

import {
  CHAIN_WALLET_NAMES,
  EVM_SOLANA_ONLY_WALLETS,
  SOLANA_ONLY_WALLETS,
  tokenToChain,
} from "./chain-wallets";
import { openIntentRef } from "./open-wallet-modal";

interface ConnectWalletModalProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "solana";
  return new URLSearchParams(window.location.search).get("token") ?? "solana";
}

const SUGGESTED_NAMES = ["Phantom", "Solflare"];

function isSuggestedWallet(wallet: Wallet, chain: null | string): boolean {
  if (chain === "solana")
    return (
      wallet.adapter.name === "Phantom" || wallet.adapter.name === "Solflare"
    );
  return SUGGESTED_NAMES.includes(wallet.adapter.name);
}

/** step 1: wallet list with "Detected" badge when extension is installed */
function WalletOption({
  disabled,
  isDetected,
  onClick,
  wallet,
}: {
  disabled: boolean;
  isDetected: boolean;
  onClick: () => void;
  wallet: Wallet;
}) {
  const icon = wallet.adapter.icon;

  return (
    <button
      className={cn(
        `
          flex w-full items-center gap-3 rounded-lg border border-border bg-card
          px-4 py-3
        `,
        `
          text-left transition-colors
          hover:bg-muted/50
          disabled:opacity-50
        `,
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon && (
        <div
          className={`
            flex shrink-0 items-center justify-center overflow-hidden rounded-md
            bg-muted/20
          `}
          style={{ height: 32, width: 32 }}
        >
          <img
            alt=""
            className="shrink-0 object-contain"
            height={32}
            src={icon}
            style={{ height: 32, minHeight: 32, minWidth: 32, width: 32 }}
            width={32}
          />
        </div>
      )}
      <span className="flex-1 font-medium">{wallet.adapter.name}</span>
      {isDetected && (
        <span
          className={`
          flex items-center gap-1.5 rounded-full bg-green-500/15 px-2 py-0.5
          text-xs font-medium text-green-700
          dark:text-green-400
        `}
        >
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
  { icon: "/crypto/ethereum/ethereum-logo.svg", id: "evms", name: "EVMs" },
  { icon: "/crypto/solana/solanaLogoMark.svg", id: "solana", name: "Solana" },
  { icon: "/crypto/sui/sui-logo.svg", id: "sui", name: "Sui" },
] as const;

const CONNECT_WAIT_MS = 30_000;

export function ConnectWalletModal({
  onOpenChange,
  open,
}: ConnectWalletModalProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const invoiceId = (params?.invoiceId as string) ?? "";
  const [token, setToken] = useState("solana");
  const [step, setStep] = useState<"network" | "requesting" | "wallet">(
    "wallet",
  );
  const [selectedWallet, setSelectedWallet] = useState<null | Wallet>(null);
  const [connectingToNetwork, setConnectingToNetwork] = useState<
    "solana" | "sui" | null
  >(null);
  const isMetaMaskDetected = useIsMetaMaskDetected();
  const { connect, connected, connecting, publicKey, select, wallets } =
    useWallet();
  const suiWallets = useWallets();
  const { mutateAsync: connectSui } = useConnectWallet();
  const connectedRef = useRef(connected);
  const [connectingWallet, setConnectingWallet] = useState<null | string>(null);
  const [connectError, setConnectError] = useState<null | string>(null);

  connectedRef.current = connected;

  useEffect(() => {
    if (open) {
      setToken(getTokenFromUrl());
      setStep("wallet");
      setSelectedWallet(null);
      setConnectingToNetwork(null);
    }
  }, [open]);

  // Close modal when Solana wallet is connected (whether user just connected or was already/reconnected).
  // Avoids leaving the modal open when: user clicked "Connect wallet" while already connected,
  // or wallet reconnected (e.g. Phantom) and user is left staring at the modal.
  // Skip auto-close when opened via "Add a new wallet" so the user can connect another address.
  const closeAfterStableMs = 400;
  useEffect(() => {
    if (!open || !connected || !publicKey) return;
    if (openIntentRef.current === "add-wallet") {
      openIntentRef.current = "connect";
      return;
    }
    const t = setTimeout(() => {
      onOpenChange(false);
    }, closeAfterStableMs);
    return () => clearTimeout(t);
  }, [open, connected, publicKey, onOpenChange]);

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
    // On desktop, only show Solflare when the extension is detected
    // On mobile, show it regardless (MWA can handle connection)
    if (w.adapter.name === "Solflare" && !isMobile)
      return w.readyState === WalletReadyState.Installed;
    return true;
  });
  const suggested = walletsToShow.filter((w) => isSuggestedWallet(w, chain));
  const others = walletsToShow.filter((w) => !isSuggestedWallet(w, chain));

  const handleSelectNetwork = useCallback(
    async (networkId: string, walletOverride?: Wallet) => {
      const wallet = walletOverride ?? selectedWallet;
      if (!wallet) return;
      if (networkId === "evms") {
        onOpenChange(false);
        return;
      }
      if (networkId === "sui") {
        setConnectError(null);
        setConnectingWallet(wallet.adapter.name);
        setConnectingToNetwork("sui");
        setStep("requesting");
        try {
          const walletName = wallet.adapter.name;
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
        setConnectingWallet(wallet.adapter.name);
        setConnectingToNetwork("solana");
        setStep("requesting");
        try {
          // On mobile, if the chosen wallet isn't installed, fall back to MWA
          // (the Mobile Wallet Adapter routes to any wallet app on the device).
          const useMwa =
            isMobile && wallet.readyState !== WalletReadyState.Installed;
          const mwaAdapter = useMwa
            ? wallets.find((w) => w.adapter.name === "Mobile Wallet Adapter")
            : null;
          const adapterName = mwaAdapter
            ? mwaAdapter.adapter.name
            : wallet.adapter.name;

          select(adapterName);
          // Give the adapter time to register the selected wallet before connect() to reduce WalletNotSelectedError
          await new Promise((r) => setTimeout(r, 400));
          const connectPromise = connect();
          const timeoutPromise = new Promise<"timeout">((resolve) =>
            setTimeout(() => resolve("timeout"), CONNECT_WAIT_MS),
          );
          const result = await Promise.race([
            connectPromise.then(() => "ok"),
            timeoutPromise,
          ]);
          if (result === "timeout" && !connectedRef.current) {
            const timeoutName = wallet?.adapter.name ?? "your wallet";
            setConnectError(
              `Connection is taking a while. Open the ${timeoutName} extension to approve, or use Back to try again.`,
            );
            // Solana-only wallets (e.g. MWA) never showed the network step; go back to wallet list
            if (SOLANA_ONLY_WALLETS.includes(wallet.adapter.name)) {
              setStep("wallet");
              setSelectedWallet(null);
            } else {
              setStep("network");
            }
          }
        } catch (err) {
          const catchName = wallet?.adapter.name ?? "your wallet";
          const isNotSelected =
            err instanceof Error &&
            (err.name === "WalletNotSelectedError" ||
              err.message?.includes("WalletNotSelected") ||
              err.message?.includes("not selected"));
          setConnectError(
            isNotSelected
              ? `Please approve the connection in your ${catchName} window. If you closed it without approving, click Connect again and approve when prompted.`
              : `Connection failed. Open the ${catchName} extension and try again, or use another wallet.`,
          );
          // Solana-only wallets (e.g. MWA) never showed the network step; go back to wallet list
          if (SOLANA_ONLY_WALLETS.includes(wallet.adapter.name)) {
            setStep("wallet");
            setSelectedWallet(null);
          } else {
            setStep("network");
          }
        } finally {
          setConnectingWallet(null);
          setConnectingToNetwork(null);
        }
      }
    },
    [
      selectedWallet,
      select,
      connect,
      suiWallets,
      connectSui,
      onOpenChange,
      isMobile,
      wallets,
    ],
  );

  const handleSelectWallet = useCallback(
    (wallet: Wallet) => {
      setSelectedWallet(wallet);
      // Solana-only wallets (e.g. MWA): skip network step and connect to Solana directly
      if (SOLANA_ONLY_WALLETS.includes(wallet.adapter.name)) {
        setConnectError(null);
        setConnectingWallet(wallet.adapter.name);
        setConnectingToNetwork("solana");
        setStep("requesting");
        void handleSelectNetwork("solana", wallet);
        return;
      }
      setStep("network");
    },
    [handleSelectNetwork],
  );

  const handleBack = useCallback(() => {
    if (step === "requesting") {
      // Solana-only wallets (e.g. MWA) skip network step, so Back goes to wallet list
      const goToNetwork =
        selectedWallet &&
        !SOLANA_ONLY_WALLETS.includes(selectedWallet.adapter.name);
      setStep(goToNetwork ? "network" : "wallet");
      if (!goToNetwork) setSelectedWallet(null);
      setConnectingWallet(null);
      setConnectingToNetwork(null);
      setConnectError(null);
      return;
    }
    setStep("wallet");
    setSelectedWallet(null);
    setConnectError(null);
  }, [step, selectedWallet]);

  const isConnecting = connecting || connectingWallet !== null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className={`
          max-w-[400px] gap-0 border-border bg-card p-0
          sm:max-w-[400px]
        `}
      >
        <div
          className={`
          flex items-center gap-2 border-b border-border px-5 py-4
        `}
        >
          {(step === "network" || step === "requesting") && (
            <button
              aria-label="Back"
              className={`
                -ml-1 rounded p-1 text-muted-foreground
                hover:bg-muted hover:text-foreground
              `}
              onClick={handleBack}
              type="button"
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
            <p
              className={`
              rounded-md border border-destructive/50 bg-destructive/10 px-3
              py-2 text-sm text-destructive
            `}
            >
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
                      <p
                        className={`
                        mb-2 text-xs font-medium tracking-wider
                        text-muted-foreground uppercase
                      `}
                      >
                        Suggested
                      </p>
                      <div className="flex flex-col gap-2">
                        {suggested.map((wallet) => (
                          <WalletOption
                            disabled={isConnecting}
                            isDetected={
                              wallet.readyState === WalletReadyState.Installed
                            }
                            key={wallet.adapter.name}
                            onClick={() => handleSelectWallet(wallet)}
                            wallet={wallet}
                          />
                        ))}
                        <button
                          className={cn(
                            `
                              flex w-full items-center gap-3 rounded-lg border
                              border-border bg-card px-4 py-3
                            `,
                            `
                              text-left transition-colors
                              hover:bg-muted/50
                            `,
                          )}
                          onClick={() => onOpenChange(false)}
                          type="button"
                        >
                          <img
                            alt=""
                            className={`
                              size-8 shrink-0 rounded-md object-contain
                            `}
                            height={32}
                            src={METAMASK_LOGO}
                            width={32}
                          />
                          <span className="flex-1 font-medium">MetaMask</span>
                          {isMetaMaskDetected && (
                            <span
                              className={`
                              flex items-center gap-1.5 rounded-full
                              bg-green-500/15 px-2 py-0.5 text-xs font-medium
                              text-green-700
                              dark:text-green-400
                            `}
                            >
                              <span
                                className={`
                                size-1.5 shrink-0 rounded-full bg-green-500
                              `}
                              />
                              Detected
                            </span>
                          )}
                          <ChevronRight
                            className={`
                            size-4 shrink-0 text-muted-foreground
                          `}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                  {others.length > 0 && (
                    <div>
                      <p
                        className={`
                        mb-2 text-xs font-medium tracking-wider
                        text-muted-foreground uppercase
                      `}
                      >
                        Others
                      </p>
                      <div className="flex flex-col gap-2">
                        {others.map((wallet) => (
                          <WalletOption
                            disabled={isConnecting}
                            isDetected={
                              wallet.readyState === WalletReadyState.Installed
                            }
                            key={wallet.adapter.name}
                            onClick={() => handleSelectWallet(wallet)}
                            wallet={wallet}
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
                  `
                    relative mb-6 flex size-20 items-center justify-center
                    rounded-2xl
                  `,
                  "animate-pulse bg-primary/5 ring-2 ring-primary/20",
                )}
              >
                {selectedWallet.adapter.icon && (
                  <img
                    alt=""
                    className="size-14 min-h-14 min-w-14 object-contain"
                    height={56}
                    src={selectedWallet.adapter.icon}
                    width={56}
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
              <p className="mt-4 text-xs text-muted-foreground">
                Use Back above if the extension doesn’t respond.
              </p>
            </div>
          )}

          {step === "network" && selectedWallet && (
            <div>
              <p
                className={`
                mb-3 text-xs font-medium tracking-wider text-muted-foreground
                uppercase
              `}
              >
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
                        className={cn(
                          `
                            flex w-full items-center gap-3 rounded-lg border
                            border-border bg-card px-4 py-3
                          `,
                          `
                            text-left transition-colors
                            hover:bg-muted/50
                          `,
                        )}
                        onClick={() => onOpenChange(false)}
                        type="button"
                      >
                        <Image
                          alt=""
                          className="size-8 shrink-0 rounded-md object-contain"
                          height={32}
                          src={network.icon}
                          width={32}
                        />
                        <span className="flex-1 font-medium">
                          {network.name}
                        </span>
                        <ChevronRight
                          className={`
                          size-4 shrink-0 text-muted-foreground
                        `}
                        />
                      </button>
                    </div>
                  ) : (
                    <button
                      className={cn(
                        `
                          flex w-full items-center gap-3 rounded-lg border
                          border-border bg-card px-4 py-3
                        `,
                        `
                          text-left transition-colors
                          hover:bg-muted/50
                          disabled:opacity-50
                        `,
                      )}
                      disabled={isConnecting}
                      key={network.id}
                      onClick={() => handleSelectNetwork(network.id)}
                      type="button"
                    >
                      <Image
                        alt=""
                        className="size-8 shrink-0 rounded-md object-contain"
                        height={32}
                        src={network.icon}
                        width={32}
                      />
                      <span className="flex-1 font-medium">{network.name}</span>
                      <ChevronRight
                        className={`
                        size-4 shrink-0 text-muted-foreground
                      `}
                      />
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

function useIsMetaMaskDetected(): boolean {
  const [detected, setDetected] = useState(false);
  useEffect(() => {
    setDetected(
      Boolean(typeof window !== "undefined" && window.ethereum?.isMetaMask),
    );
  }, []);
  return detected;
}
