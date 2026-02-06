"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Wallet } from "@solana/wallet-adapter-react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useConnectors, useSignMessage } from "wagmi";

import { SYSTEM_CONFIG } from "~/app";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";
import { cn } from "~/lib/cn";

/** Ethereum / WalletConnect options shown in the wallet list (wallets-first flow). */
const ETHEREUM_WALLET_OPTIONS = [
  { id: "walletconnect" as const, name: "WalletConnect", icon: "https://avatars.githubusercontent.com/u/37784886?s=200&v=4" },
  { id: "injected" as const, name: "MetaMask", icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" },
  { id: "injected" as const, name: "Coinbase Wallet", icon: "https://www.coinbase.com/img/favicon/favicon-256.png" },
] as const;

/** 
 * Names of wallets that appear in both Solana adapters and Ethereum options.
 * These are filtered out from ETHEREUM_WALLET_OPTIONS to avoid duplicates.
 * They will only show once from the Solana wallet adapters list.
 */
const SOLANA_WALLET_NAMES_TO_SKIP = ["Ctrl Wallet", "Ctrl", "Brave Wallet", "Brave"];

const SUGGESTED_SOLANA_NAMES = ["Phantom", "Solflare"];

function EthereumOptionButton({
  name,
  icon,
  isDetected,
  onClick,
  disabled,
}: {
  name: string;
  icon: string;
  isDetected?: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
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
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={icon}
          alt=""
          className="size-8 object-contain"
          width={32}
          height={32}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
      <span className="flex-1 font-medium">{name}</span>
      {isDetected && (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          Detected
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

const API_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? process.env.NEXT_PUBLIC_APP_URL
      : "";

export const OPEN_AUTH_WALLET_MODAL = "open-auth-wallet-modal";
/** Dispatch this from dashboard to open the modal in link mode (connect wallet to current account). */
export const OPEN_LINK_WALLET_MODAL = "open-link-wallet-modal";
/** Dispatched when a wallet is successfully linked to refresh account lists. */
export const WALLET_LINKED_EVENT = "wallet-linked";

type AuthWalletModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, link wallet to current account instead of signing in */
  link?: boolean;
};

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
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/20">
          <img
            src={icon}
            alt=""
            className="object-contain"
            width={32}
            height={32}
          />
        </div>
      )}
      <span className="flex-1 font-medium">{wallet.adapter.name}</span>
      {isDetected && (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          Detected
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export function AuthWalletModal({
  open,
  onOpenChange,
  link = false,
}: AuthWalletModalProps) {
  const router = useRouter();
  const {
    wallets,
    select,
    connect,
    disconnect,
    publicKey,
    connected,
    connecting,
    signMessage,
  } = useWallet();

  const signFlowStarted = useRef(false);
  const [step, setStep] = useState<"wallet" | "signing" | "error">("wallet");
  const [error, setError] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [selectedChain, setSelectedChain] = useState<
    "solana" | "ethereum" | null
  >(null);
  /** When user picks an Ethereum option: "walletconnect" or "injected" (MetaMask/Brave/etc.). */
  const [selectedEthereumOption, setSelectedEthereumOption] = useState<
    "walletconnect" | "injected" | null
  >(null);

  const [isMetaMaskDetected, setIsMetaMaskDetected] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMetaMaskDetected(Boolean((window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask));
  }, []);

  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { address: evmAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const wcSignDoneRef = useRef(false);

  const solanaWallets = wallets.filter(
    (w) =>
      w.readyState === WalletReadyState.Installed ||
      w.readyState === WalletReadyState.Loadable,
  );

  const handleSelectEthereumOption = useCallback(
    (option: "walletconnect" | "injected") => {
      setError("");
      setSelectedChain("ethereum");
      setSelectedEthereumOption(option);
      setStep("signing");
    },
    [],
  );

  const handleSelectWallet = useCallback(
    async (wallet: Wallet) => {
      setError("");
      setSelectedWallet(wallet);
      setSelectedChain("solana"); // Mark as Solana wallet
      try {
        console.log("[auth] Selecting Solana wallet:", wallet.adapter.name);
        select(wallet.adapter.name);
        // Give the adapter time to initialize
        await new Promise((r) => setTimeout(r, 200));
        console.log("[auth] Connecting to Solana wallet...");
        await connect();
        console.log("[auth] Solana wallet connected, moving to signing step");
        // Additional delay to ensure wallet state is fully updated
        await new Promise((r) => setTimeout(r, 100));
        setStep("signing");
      } catch (err) {
        console.error("[auth] Solana wallet connection failed:", err);
        setError("Connection failed. Try again or use another wallet.");
        setStep("wallet");
        setSelectedChain(null);
      }
    },
    [select, connect],
  );

  // If Solana wallet disconnects while we're on "Sign the message", show error so user isn't stuck
  useEffect(() => {
    if (
      !open ||
      selectedChain !== "solana" ||
      step !== "signing" ||
      (connected && publicKey)
    )
      return;
    signFlowStarted.current = false;
    setError("Wallet disconnected. Please try again and sign the message in your wallet.");
    setStep("error");
  }, [open, selectedChain, step, connected, publicKey]);

  // Solana: run sign flow when wallet is connected and step is signing
  useEffect(() => {
    if (!open || selectedChain !== "solana") return;
    
    // Debug: log state when in signing step
    if (step === "signing") {
      console.log("[auth] Solana signing state:", { connected, publicKey: publicKey?.toBase58(), hasSignMessage: !!signMessage, signFlowStarted: signFlowStarted.current });
    }
    
    // If we're in signing step but signMessage is not available after connection, show error
    if (step === "signing" && connected && publicKey && !signMessage && !signFlowStarted.current) {
      console.error("[auth] Solana: signMessage not available from wallet adapter");
      setError("This wallet doesn't support message signing. Please try another wallet.");
      setStep("error");
      return;
    }
    
    if (
      step === "signing" &&
      connected &&
      publicKey &&
      signMessage &&
      !signFlowStarted.current
    ) {
      signFlowStarted.current = true;
      let cancelled = false;
      (async () => {
        const isDev =
          typeof process !== "undefined" &&
          process.env.NODE_ENV === "development";
        try {
          console.info("[auth] Solana: requesting challenge…");
          const res = await fetch(
            `${API_BASE}/api/auth/sign-in/solana/challenge`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ address: publicKey.toBase58() }),
            },
          );
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              (data as { message?: string }).message ??
                "Failed to get challenge",
            );
          }
          const { message } = (await res.json()) as { message: string };
          if (cancelled) return;

          const messageBytes = new TextEncoder().encode(message);
          const rawResult = await signMessage(messageBytes);
          if (cancelled) return;

          // Wallets may return Uint8Array or { signature: Uint8Array } or { signature: string } (base58)
          const sig: Uint8Array | string =
            rawResult &&
            typeof rawResult === "object" &&
            "signature" in rawResult &&
            (rawResult as { signature: unknown }).signature !== undefined
              ? (rawResult as { signature: Uint8Array | string }).signature
              : (rawResult as unknown as Uint8Array);
          const isBase58 =
            typeof sig === "string" &&
            /^[1-9A-HJ-NP-Za-km-z]+$/.test(sig) &&
            sig.length >= 80;
          const bytes: Uint8Array | null =
            typeof sig === "string"
              ? null
              : sig instanceof ArrayBuffer
                ? new Uint8Array(sig)
                : sig instanceof Uint8Array
                  ? sig
                  : ArrayBuffer.isView(sig)
                    ? new Uint8Array((sig as Uint8Array).buffer, (sig as Uint8Array).byteOffset, (sig as Uint8Array).byteLength)
                    : null;
          const signatureBase64 =
            bytes != null
              ? typeof Buffer !== "undefined"
                ? Buffer.from(bytes).toString("base64")
                : btoa(String.fromCharCode.apply(null, Array.from(bytes)))
              : undefined;
          const signatureBase58 =
            isBase58 && typeof sig === "string" ? sig : undefined;
          if (!signatureBase64 && !signatureBase58) {
            throw new Error("Could not read signature from wallet. Try again.");
          }
          console.info("[auth] Solana: verifying signature…");
          const verifyRes = await fetch(
            `${API_BASE}/api/auth/sign-in/solana/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                address: publicKey.toBase58(),
                message,
                ...(signatureBase64 ? { signature: signatureBase64 } : {}),
                ...(signatureBase58 ? { signatureBase58 } : {}),
                link: link || undefined,
              }),
            },
          );
          if (!verifyRes.ok) {
            const data = await verifyRes.json().catch(() => ({}));
            const msg =
              (data as { message?: string }).message ?? "Verification failed";
            if (isDev) console.error("[auth] Solana verify failed:", msg);
            throw new Error(msg);
          }
          console.info("[auth] Solana sign-in succeeded");
          if (cancelled) return;
          // Move focus out of modal before closing to avoid "Blocked aria-hidden" and flash
          (document.activeElement as HTMLElement)?.blur?.();
          onOpenChange(false);
          if (link) {
            // Dispatch event so security page can refresh accounts list
            window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
            router.refresh();
          } else {
            // Full page nav so the next request includes the new session cookie.
            // Brief delay so the browser persists Set-Cookie before we leave the page.
            const url = SYSTEM_CONFIG.redirectAfterSignIn;
            setTimeout(() => {
              window.location.href = url;
            }, 150);
          }
        } catch (err) {
          if (!cancelled) {
            // Always log the error for debugging
            console.error("[auth] Solana sign-in error:", err);
            
            const rawMessage =
              err instanceof Error ? err.message : "Something went wrong";
            const isDisconnect =
              /disconnect|wallet.*closed|user.*reject|rejected/i.test(
                rawMessage,
              ) ||
              (err instanceof Error &&
                err.constructor?.name === "WalletDisconnectedError");
            const isChallengeError = /challenge|expired|invalid/i.test(rawMessage);
            const isSignatureError = /signature/i.test(rawMessage);
            
            let message: string;
            if (isDisconnect) {
              message = "Wallet disconnected or signing was cancelled. Please try again and sign the message in your wallet.";
            } else if (isChallengeError) {
              message = "Session expired. Please try again.";
            } else if (isSignatureError) {
              message = "Signature verification failed. Please try again.";
            } else {
              message = rawMessage;
            }
            
            setError(message);
            setStep("error");
            signFlowStarted.current = false;
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [
    open,
    selectedChain,
    step,
    connected,
    publicKey,
    signMessage,
    link,
    onOpenChange,
    router,
  ]);

  // WalletConnect: connect first, then SIWE runs in the next effect when evmAddress is set
  useEffect(() => {
    if (
      !open ||
      selectedChain !== "ethereum" ||
      step !== "signing" ||
      selectedEthereumOption !== "walletconnect"
    )
      return;
    if (signFlowStarted.current) return;
    const wcConnector = connectors?.find(
      (c) => (c as { type?: string }).type === "walletConnect",
    );
    if (!wcConnector) {
      setError("WalletConnect is not available. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.");
      setStep("error");
      return;
    }
    signFlowStarted.current = true;
    let cancelled = false;
    connectAsync({ connector: wcConnector })
      .then(() => {
        if (cancelled) return;
        // evmAddress is set by wagmi; SIWE effect runs when evmAddress is present
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "WalletConnect failed");
          setStep("error");
          signFlowStarted.current = false;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedChain,
    step,
    selectedEthereumOption,
    connectors,
    connectAsync,
  ]);

  // WalletConnect SIWE: once we have evmAddress after connect, do challenge + sign + verify
  useEffect(() => {
    if (
      !open ||
      selectedChain !== "ethereum" ||
      selectedEthereumOption !== "walletconnect" ||
      step !== "signing" ||
      !evmAddress ||
      wcSignDoneRef.current ||
      !signMessageAsync
    )
      return;
    wcSignDoneRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/auth/sign-in/ethereum/challenge`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ address: evmAddress }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Failed to get challenge",
          );
        }
        const { message } = (await res.json()) as { message: string };
        if (cancelled) return;
        const signature = await signMessageAsync({ message });
        if (cancelled) return;
        const verifyRes = await fetch(
          `${API_BASE}/api/auth/sign-in/ethereum/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              address: evmAddress,
              message,
              signature,
              link: link || undefined,
            }),
          },
        );
        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Verification failed",
          );
        }
        if (cancelled) return;
        (document.activeElement as HTMLElement)?.blur?.();
        onOpenChange(false);
        if (link) {
          window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
          router.refresh();
        } else {
          const url = SYSTEM_CONFIG.redirectAfterSignIn;
          setTimeout(() => {
            window.location.href = url;
          }, 150);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Something went wrong",
          );
          setStep("error");
          signFlowStarted.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedChain,
    selectedEthereumOption,
    step,
    evmAddress,
    signMessageAsync,
    link,
    onOpenChange,
    router,
  ]);

  // Ethereum injected (SIWE): use window.ethereum (MetaMask, Brave, etc.)
  useEffect(() => {
    if (!open || selectedChain !== "ethereum" || step !== "signing") return;
    if (selectedEthereumOption === "walletconnect") return;
    if (signFlowStarted.current) return;
    signFlowStarted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const win =
          typeof window !== "undefined"
            ? (window as unknown as {
                ethereum?: {
                  request: (args: {
                    method: string;
                    params?: unknown[];
                  }) => Promise<unknown>;
                  providers?: unknown[];
                  isMetaMask?: boolean;
                };
                phantom?: { ethereum?: unknown };
              })
            : null;
        const raw = win?.ethereum;
        let eth: typeof raw = undefined;
        if (raw) {
          if (Array.isArray(raw.providers) && raw.providers.length > 0) {
            const providers = raw.providers as Array<{ isMetaMask?: boolean }>;
            const metaMask = providers.find((p) => p?.isMetaMask);
            const nonPhantom = (raw.providers as unknown[]).find(
              (p) => p !== win?.phantom?.ethereum,
            );
            eth = (metaMask ?? nonPhantom ?? raw.providers[0]) as typeof raw;
          } else if (raw !== win?.phantom?.ethereum) {
            eth = raw;
          } else {
            eth = raw;
          }
        }
        if (!eth?.request) {
          throw new Error(
            "No Ethereum wallet found. Install MetaMask or another Web3 wallet.",
          );
        }
        const accounts = (await eth.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (cancelled || !accounts?.[0]) {
          throw new Error("No account selected.");
        }
        const address = accounts[0];
        const res = await fetch(
          `${API_BASE}/api/auth/sign-in/ethereum/challenge`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ address }),
          },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Failed to get challenge",
          );
        }
        const { message } = (await res.json()) as { message: string };
        if (cancelled) return;
        const signature = (await eth.request({
          method: "personal_sign",
          params: [message, address],
        })) as string;
        if (cancelled) return;
        const verifyRes = await fetch(
          `${API_BASE}/api/auth/sign-in/ethereum/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              address,
              message,
              signature,
              link: link || undefined,
            }),
          },
        );
        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Verification failed",
          );
        }
        if (cancelled) return;
        (document.activeElement as HTMLElement)?.blur?.();
        onOpenChange(false);
        if (link) {
          // Dispatch event so security page can refresh accounts list
          window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
          router.refresh();
        } else {
          const url = SYSTEM_CONFIG.redirectAfterSignIn;
          setTimeout(() => {
            window.location.href = url;
          }, 150);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setStep("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedChain, step, link, onOpenChange, router]);

  useEffect(() => {
    if (!open) {
      setStep("wallet");
      setError("");
      setSelectedWallet(null);
      setSelectedChain(null);
      setSelectedEthereumOption(null);
      signFlowStarted.current = false;
      wcSignDoneRef.current = false;
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px] gap-0 border-border bg-card p-0 sm:max-w-[400px]"
        aria-describedby={undefined}
      >
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            {link ? "Connect wallet to account" : "Sign in with wallet"}
          </DialogTitle>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {error && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {step === "wallet" && (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Suggested
              </p>
              <div className="flex flex-col gap-2">
                {solanaWallets
                  .filter(
                    (w, i, self) =>
                      SUGGESTED_SOLANA_NAMES.includes(w.adapter.name) &&
                      i === self.findIndex((x) => x.adapter.name === w.adapter.name),
                  )
                  .map((wallet, index) => (
                    <WalletOption
                      key={`${wallet.adapter.name}-${index}`}
                      wallet={wallet}
                      onClick={() => handleSelectWallet(wallet)}
                      disabled={connecting}
                      isDetected={
                        wallet.readyState === WalletReadyState.Installed
                      }
                    />
                  ))}
                <EthereumOptionButton
                  name="MetaMask"
                  icon={ETHEREUM_WALLET_OPTIONS[1].icon}
                  isDetected={isMetaMaskDetected}
                  onClick={() => handleSelectEthereumOption("injected")}
                  disabled={connecting}
                />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Others
              </p>
              <div className="flex flex-col gap-2">
                {solanaWallets
                  .filter(
                    (wallet, index, self) =>
                      !SUGGESTED_SOLANA_NAMES.includes(wallet.adapter.name) &&
                      index ===
                        self.findIndex(
                          (w) => w.adapter.name === wallet.adapter.name,
                        ),
                  )
                  .map((wallet, index) => (
                    <WalletOption
                      key={`${wallet.adapter.name}-${index}`}
                      wallet={wallet}
                      onClick={() => handleSelectWallet(wallet)}
                      disabled={connecting}
                      isDetected={
                        wallet.readyState === WalletReadyState.Installed
                      }
                    />
                  ))}
                {ETHEREUM_WALLET_OPTIONS.filter(
                  (o) =>
                    o.name !== "MetaMask" &&
                    !SOLANA_WALLET_NAMES_TO_SKIP.includes(o.name),
                ).map((opt) => (
                  <EthereumOptionButton
                    key={opt.name}
                    name={opt.name}
                    icon={opt.icon}
                    onClick={() =>
                      handleSelectEthereumOption(
                        opt.id === "walletconnect" ? "walletconnect" : "injected",
                      )
                    }
                    disabled={connecting}
                  />
                ))}
              </div>
            </div>
          )}

          {(step === "signing" || step === "error") && (
            <div className="flex flex-col items-center py-6 text-center">
              {step === "signing" && (
                <>
                  <p className="text-lg font-semibold">Sign the message</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {selectedChain === "ethereum"
                      ? selectedEthereumOption === "walletconnect"
                        ? "Complete connection in WalletConnect, then sign the message to finish."
                        : "Open your Ethereum wallet (e.g. MetaMask) to sign and complete sign-in."
                      : `Open ${selectedWallet?.adapter.name ?? "your wallet"} to sign and complete sign-in.`}
                  </p>
                </>
              )}
              {step === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    signFlowStarted.current = false;
                    wcSignDoneRef.current = false;
                    setStep(
                      selectedChain === "ethereum" ? "signing" : "wallet",
                    );
                  }}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
