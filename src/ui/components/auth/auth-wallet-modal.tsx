"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useConnectors, useSignMessage } from "wagmi";

import { SYSTEM_CONFIG } from "~/app";
import { useSolanaWallet } from "~/app/checkout/crypto/solana-wallet-stub";
import { cn } from "~/lib/cn";
import { WALLET_LINKED_EVENT } from "~/ui/components/auth/auth-wallet-modal-events";
import { Button } from "~/ui/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";

/** Ethereum / WalletConnect options shown in the wallet list (wallets-first flow). */
const ETHEREUM_WALLET_OPTIONS = [
  {
    icon: "https://avatars.githubusercontent.com/u/37784886?s=200&v=4",
    id: "walletconnect" as const,
    name: "WalletConnect",
  },
  {
    icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
    id: "injected" as const,
    name: "MetaMask",
  },
  {
    icon: "https://www.coinbase.com/img/favicon/favicon-256.png",
    id: "injected" as const,
    name: "Coinbase Wallet",
  },
] as const;

/**
 * Names of wallets that appear in both Solana adapters and Ethereum options.
 * These are filtered out from ETHEREUM_WALLET_OPTIONS to avoid duplicates.
 * They will only show once from the Solana wallet adapters list.
 */
const SOLANA_WALLET_NAMES_TO_SKIP = [
  "Ctrl Wallet",
  "Ctrl",
  "Brave Wallet",
  "Brave",
];

/** Wallets that support both Solana and EVM; after selecting one we show "Choose network" step. */
const MULTI_CHAIN_WALLET_NAMES = [
  "Phantom",
  "Ctrl Wallet",
  "Ctrl",
  "Brave Wallet",
  "Brave",
];

/** Return true if this wallet should see the "Choose network" (Solana vs EVM) step. */
function isMultiChainWallet(name: string): boolean {
  const lower = name.toLowerCase();
  if (MULTI_CHAIN_WALLET_NAMES.some((n) => n.toLowerCase() === lower))
    return true;
  if (lower.includes("ctrl")) return true; // e.g. "Ctrl", "Ctrl Wallet", any variant
  if (lower === "phantom") return true;
  return false;
}

const SUGGESTED_SOLANA_NAMES = ["Phantom", "Solflare"];

/** minimal wallet shape from stub or real adapter (so we don't depend on full Wallet type here) */
interface SolanaWalletOption {
  adapter: { icon?: string; name?: string };
  readyState?: number | string;
}

function EthereumOptionButton({
  disabled,
  icon,
  isDetected,
  name,
  onClick,
}: {
  disabled: boolean;
  icon: string;
  isDetected?: boolean;
  name: string;
  onClick: () => void;
}) {
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
      <div
        className={`
          flex size-8 shrink-0 items-center justify-center overflow-hidden
          rounded-md bg-muted/20
        `}
      >
        {}
        <Image
          alt=""
          className="size-8 object-contain"
          height={32}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          src={icon}
          unoptimized
          width={32}
        />
      </div>
      <span className="flex-1 font-medium">{name}</span>
      {isDetected && (
        <span
          className={`
            rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium
            text-green-700
            dark:text-green-400
          `}
        >
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

export {
  OPEN_AUTH_WALLET_MODAL,
  OPEN_LINK_WALLET_MODAL,
  OPEN_SOLANA_WALLET_MODAL,
  WALLET_LINKED_EVENT,
} from "~/ui/components/auth/auth-wallet-modal-events";

interface AuthWalletModalProps {
  /** When true, skip SIWE auth and just connect the wallet (for staking flows). */
  connectOnly?: boolean;
  /** When true, link wallet to current account instead of signing in */
  link?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** When true, only show Solana wallets (no EVM options). Used for staking flows. */
  solanaOnly?: boolean;
}

export function AuthWalletModal({
  connectOnly = false,
  link = false,
  onOpenChange,
  open,
  solanaOnly = false,
}: AuthWalletModalProps) {
  const router = useRouter();
  const {
    connect,
    connected,
    connecting,
    disconnect: _disconnect,
    publicKey,
    select,
    signMessage,
    wallet: currentWallet,
    wallets,
  } = useSolanaWallet();

  const signFlowStarted = useRef(false);
  /** Prevent duplicate connect() when effect re-runs before adapter state updates. */
  const solanaConnectStartedRef = useRef(false);
  const [step, setStep] = useState<"error" | "network" | "signing" | "wallet">(
    "wallet",
  );
  const [error, setError] = useState("");
  const [selectedWallet, setSelectedWallet] =
    useState<null | SolanaWalletOption>(null);
  const [selectedChain, setSelectedChain] = useState<
    "ethereum" | "solana" | null
  >(null);
  /** True after select() is called; cleared when the connect effect fires or on modal close. */
  const [pendingSolanaConnect, setPendingSolanaConnect] = useState(false);
  /** When user picks an Ethereum option: "walletconnect" or "injected" (MetaMask/Brave/etc.). */
  const [selectedEthereumOption, setSelectedEthereumOption] = useState<
    "injected" | "walletconnect" | null
  >(null);
  /** Solana: challenge ready; sign is triggered by user click so the wallet shows the sign popup. */
  const [solanaChallengePending, setSolanaChallengePending] = useState<null | {
    message: string;
    messageBytes: Uint8Array;
  }>(null);
  const [solanaSigning, setSolanaSigning] = useState(false);

  const [isMetaMaskDetected, setIsMetaMaskDetected] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMetaMaskDetected(
      Boolean(
        (window as unknown as { ethereum?: { isMetaMask?: boolean } }).ethereum
          ?.isMetaMask,
      ),
    );
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
    (option: "injected" | "walletconnect") => {
      setError("");
      setSelectedChain("ethereum");
      setSelectedEthereumOption(option);
      setStep("signing");
    },
    [],
  );

  const handleSelectWallet = useCallback(
    (wallet: SolanaWalletOption) => {
      setError("");
      setSelectedWallet(wallet);
      solanaConnectStartedRef.current = false;
      const name = wallet.adapter.name ?? "";
      // In solanaOnly mode, skip the network selection step even for multi-chain wallets
      if (!solanaOnly && isMultiChainWallet(name)) {
        setStep("network");
        return;
      }
      setSelectedChain("solana");
      const adapterName = wallet.adapter.name;
      if (!adapterName) return;
      setPendingSolanaConnect(true);
      setTimeout(() => {
        select(adapterName);
      }, 0);
    },
    [select, solanaOnly],
  );

  const handleSelectNetwork = useCallback(
    (chain: "ethereum" | "solana") => {
      setError("");
      setSelectedChain(chain);
      const wallet = selectedWallet;
      if (!wallet) return;
      if (chain === "ethereum") {
        setSelectedEthereumOption("injected");
        setStep("signing");
        return;
      }
      solanaConnectStartedRef.current = false;
      const adapterName = wallet.adapter.name;
      if (!adapterName) return;
      setPendingSolanaConnect(true);
      const DEFER_MS = 50;
      setTimeout(() => {
        select(adapterName);
      }, DEFER_MS);
    },
    [selectedWallet, select],
  );

  // Solana: once the wallet adapter registers the selection (currentWallet becomes available),
  // call connect() once. Ref prevents duplicate connect() when effect re-runs (e.g. Strict Mode).
  // When user approves in Phantom, the adapter sets connected/publicKey; we must transition to
  // "signing" even if pendingSolanaConnect was already cleared when we started connect().
  useEffect(() => {
    if (!open) return;
    if (!currentWallet) return;
    // Wallet just became connected (e.g. user approved in Phantom) — move to signing step
    // or close if connectOnly mode.
    // Check step/selectedChain so we only do this when we're on the network step waiting for connection.
    if (
      (step === "network" || step === "wallet") &&
      selectedChain === "solana" &&
      connected &&
      publicKey
    ) {
      setPendingSolanaConnect(false);
      solanaConnectStartedRef.current = false;
      if (connectOnly) {
        onOpenChange(false);
        return;
      }
      setStep("signing");
      return;
    }
    if (!pendingSolanaConnect) return;
    if (connecting) return;
    // Only start connect once per selection
    if (solanaConnectStartedRef.current) return;
    solanaConnectStartedRef.current = true;
    setPendingSolanaConnect(false);

    let cancelled = false;
    const connectPromise = connect();
    const timeoutMs = 45000;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      console.error("[auth] Solana connect timed out after", timeoutMs, "ms");
      solanaConnectStartedRef.current = false;
      setError(
        "Connection is taking too long. Check that your wallet extension is unlocked and try again. If you use an ad blocker, try disabling it for this site.",
      );
      setStep("wallet");
      setSelectedWallet(null);
      setSelectedChain(null);
    }, timeoutMs);

    connectPromise
      .then(async () => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        solanaConnectStartedRef.current = false;
        await new Promise((r) => setTimeout(r, 100));
        if (cancelled) return;
        if (connectOnly) {
          onOpenChange(false);
        } else {
          setStep("signing");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        solanaConnectStartedRef.current = false;
        console.error("[auth] Solana wallet connection failed:", err);
        const msg = err instanceof Error ? err.message : "";
        const isUserRejection =
          /reject|denied|declined|closed|disconnect|not authorized/i.test(msg);
        setError(
          isUserRejection
            ? "Connection was rejected. Please try again and approve the connection in your wallet."
            : "Connection failed. Try again or use another wallet.",
        );
        setStep("wallet");
        setSelectedWallet(null);
        setSelectedChain(null);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    pendingSolanaConnect,
    open,
    currentWallet,
    connected,
    connecting,
    publicKey,
    connect,
    step,
    selectedChain,
    connectOnly,
    onOpenChange,
  ]);

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
    setError(
      "Wallet disconnected. Please try again and sign the message in your wallet.",
    );
    setStep("error");
  }, [open, selectedChain, step, connected, publicKey]);

  // Solana: run sign flow when wallet is connected and step is signing
  useEffect(() => {
    if (!open || selectedChain !== "solana") return;

    // If we're in signing step but signMessage is not available after connection, show error
    if (
      step === "signing" &&
      connected &&
      publicKey &&
      !signMessage &&
      !signFlowStarted.current
    ) {
      console.error(
        "[auth] Solana: signMessage not available from wallet adapter",
      );
      setError(
        "This wallet doesn't support message signing. Please try another wallet.",
      );
      setStep("error");
      return;
    }

    if (
      step === "signing" &&
      connected &&
      publicKey &&
      signMessage &&
      !signFlowStarted.current &&
      !solanaChallengePending
    ) {
      signFlowStarted.current = true;
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/api/auth/sign-in/solana/challenge`,
            {
              body: JSON.stringify({ address: publicKey.toBase58() }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
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
          setSolanaChallengePending({ message, messageBytes });
        } catch (err) {
          if (!cancelled) {
            console.error("[auth] Solana challenge error:", err);
            setError(
              err instanceof Error ? err.message : "Failed to get challenge",
            );
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
    solanaChallengePending,
  ]);

  const handleSolanaSignClick = useCallback(async () => {
    if (!solanaChallengePending || !publicKey || !signMessage) return;
    setSolanaSigning(true);
    setError("");
    const isDev =
      typeof process !== "undefined" && process.env.NODE_ENV === "development";
    try {
      const rawResult = await signMessage(solanaChallengePending.messageBytes);

      // Wallets may return Uint8Array or { signature: Uint8Array } or { signature: string } (base58)
      const sig: string | Uint8Array =
        rawResult &&
        typeof rawResult === "object" &&
        "signature" in rawResult &&
        (rawResult as { signature: unknown }).signature !== undefined
          ? (rawResult as { signature: string | Uint8Array }).signature
          : (rawResult as unknown as Uint8Array);
      const isBase58 =
        typeof sig === "string" &&
        /^[1-9A-HJ-NP-Za-km-z]+$/.test(sig) &&
        sig.length >= 80;
      const bytes: null | Uint8Array =
        typeof sig === "string"
          ? null
          : sig instanceof ArrayBuffer
            ? new Uint8Array(sig)
            : sig instanceof Uint8Array
              ? sig
              : ArrayBuffer.isView(sig)
                ? new Uint8Array(
                    (sig as Uint8Array).buffer,
                    (sig as Uint8Array).byteOffset,
                    (sig as Uint8Array).byteLength,
                  )
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
      const verifyRes = await fetch(
        `${API_BASE}/api/auth/sign-in/solana/verify`,
        {
          body: JSON.stringify({
            address: publicKey.toBase58(),
            message: solanaChallengePending.message,
            ...(signatureBase64 ? { signature: signatureBase64 } : {}),
            ...(signatureBase58 ? { signatureBase58 } : {}),
            link: link || undefined,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        const msg =
          (data as { message?: string }).message ?? "Verification failed";
        if (isDev) console.error("[auth] Solana verify failed:", msg);
        throw new Error(msg);
      }
      const verifyData = (await verifyRes.json()) as {
        created?: boolean;
        user?: unknown;
      };
      (document.activeElement as HTMLElement)?.blur?.();
      onOpenChange(false);
      if (link) {
        window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
        router.refresh();
      } else if (verifyData.created) {
        // New account created via wallet: keep user on current page to shop
        router.refresh();
      } else {
        const url = SYSTEM_CONFIG.redirectAfterSignIn;
        setTimeout(() => {
          window.location.href = url;
        }, 150);
      }
    } catch (err) {
      console.error("[auth] Solana sign-in error:", err);
      const rawMessage =
        err instanceof Error ? err.message : "Something went wrong";
      const isUserRejection =
        /disconnect|wallet.*closed|user.*reject|rejected|not been authorized|not authorized by the user|denied|declined/i.test(
          rawMessage,
        ) ||
        (err instanceof Error &&
          err.constructor?.name === "WalletDisconnectedError");
      const isChallengeError = /challenge|expired|invalid/i.test(rawMessage);
      const isSignatureError = /signature/i.test(rawMessage);
      let message: string;
      if (isUserRejection) {
        message =
          "You declined to sign. Please try again and approve the message in your wallet to complete sign-in.";
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
    } finally {
      setSolanaSigning(false);
    }
  }, [
    solanaChallengePending,
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
      setError(
        "WalletConnect is not available. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.",
      );
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
            body: JSON.stringify({ address: evmAddress }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
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
            body: JSON.stringify({
              address: evmAddress,
              link: link || undefined,
              message,
              signature,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Verification failed",
          );
        }
        if (cancelled) return;
        const verifyData = (await verifyRes.json()) as {
          created?: boolean;
          user?: unknown;
        };
        (document.activeElement as HTMLElement)?.blur?.();
        onOpenChange(false);
        if (link) {
          window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
          router.refresh();
        } else if (verifyData.created) {
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
                  isMetaMask?: boolean;
                  providers?: unknown[];
                  request: (args: {
                    method: string;
                    params?: unknown[];
                  }) => Promise<unknown>;
                };
                phantom?: { ethereum?: unknown };
              })
            : null;
        const raw = win?.ethereum;
        let eth: typeof raw;
        if (raw) {
          if (Array.isArray(raw.providers) && raw.providers.length > 0) {
            const providers = raw.providers as { isMetaMask?: boolean }[];
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
            body: JSON.stringify({ address }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
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
            body: JSON.stringify({
              address,
              link: link || undefined,
              message,
              signature,
            }),
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            method: "POST",
          },
        );
        if (!verifyRes.ok) {
          const data = await verifyRes.json().catch(() => ({}));
          throw new Error(
            (data as { message?: string }).message ?? "Verification failed",
          );
        }
        if (cancelled) return;
        const verifyData = (await verifyRes.json()) as {
          created?: boolean;
          user?: unknown;
        };
        (document.activeElement as HTMLElement)?.blur?.();
        onOpenChange(false);
        if (link) {
          // Dispatch event so security page can refresh accounts list
          window.dispatchEvent(new CustomEvent(WALLET_LINKED_EVENT));
          router.refresh();
        } else if (verifyData.created) {
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
  }, [
    open,
    selectedChain,
    step,
    link,
    onOpenChange,
    router,
    selectedEthereumOption,
  ]);

  useEffect(() => {
    if (!open) {
      setStep("wallet");
      setError("");
      setSelectedWallet(null);
      setSelectedChain(null);
      setSelectedEthereumOption(null);
      setSolanaChallengePending(null);
      setSolanaSigning(false);
      setPendingSolanaConnect(false);
      signFlowStarted.current = false;
      wcSignDoneRef.current = false;
    }
  }, [open]);

  const handleTryAgain = useCallback(() => {
    setError("");
    signFlowStarted.current = false;
    wcSignDoneRef.current = false;
    setSolanaChallengePending(null);
    setSolanaSigning(false);
    if (
      selectedWallet &&
      isMultiChainWallet(selectedWallet.adapter.name ?? "")
    ) {
      setStep("network");
    } else {
      setStep(selectedChain === "ethereum" ? "signing" : "wallet");
    }
  }, [selectedWallet, selectedChain]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className={`
          max-w-[400px] gap-0 border-border bg-card p-0
          sm:max-w-[400px]
        `}
      >
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            {connectOnly
              ? "Connect wallet to stake"
              : solanaOnly
                ? "Connect Solana wallet"
                : link
                  ? "Connect wallet to account"
                  : "Sign in with wallet"}
          </DialogTitle>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          {error && (
            <p
              className={`
                rounded-md border border-destructive/50 bg-destructive/10 px-3
                py-2 text-sm text-destructive
              `}
            >
              {error}
            </p>
          )}

          {step === "network" && selectedWallet && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedWallet.adapter.name} supports multiple networks. Choose
                one to sign in with:
              </p>
              <div className="flex flex-col gap-2">
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
                  disabled={
                    connecting ||
                    (selectedChain === "solana" && pendingSolanaConnect)
                  }
                  onClick={() => handleSelectNetwork("solana")}
                  type="button"
                >
                  <div
                    className={`
                      flex size-8 shrink-0 items-center justify-center
                      overflow-hidden rounded-md bg-muted/20
                    `}
                  >
                    <Image
                      alt=""
                      className="object-contain"
                      height={32}
                      src="/crypto/solana/solanaLogoMark.svg"
                      width={32}
                    />
                  </div>
                  <span className="flex-1 font-medium">
                    {selectedChain === "solana" && pendingSolanaConnect
                      ? "Connecting…"
                      : "Solana"}
                  </span>
                  <ChevronRight
                    className={`size-4 shrink-0 text-muted-foreground`}
                  />
                </button>
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
                  disabled={connecting}
                  onClick={() => handleSelectNetwork("ethereum")}
                  type="button"
                >
                  <div
                    className={`
                      flex size-8 shrink-0 items-center justify-center
                      overflow-hidden rounded-md bg-muted/20
                    `}
                  >
                    <Image
                      alt=""
                      className="object-contain"
                      height={32}
                      src="/crypto/ethereum/ethereum-logo.svg"
                      width={32}
                    />
                  </div>
                  <span className="flex-1 font-medium">Ethereum (EVM)</span>
                  <ChevronRight
                    className={`size-4 shrink-0 text-muted-foreground`}
                  />
                </button>
              </div>
              <button
                className={`
                  text-sm text-muted-foreground
                  hover:text-foreground hover:underline
                `}
                onClick={() => {
                  setStep("wallet");
                  setSelectedWallet(null);
                  setSelectedChain(null);
                  setError("");
                }}
                type="button"
              >
                ← Back to wallet list
              </button>
            </div>
          )}

          {step === "wallet" && (
            <div className="space-y-4">
              <p
                className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
              >
                Suggested
              </p>
              <div className="flex flex-col gap-2">
                {solanaWallets
                  .filter(
                    (w, i, self) =>
                      w.adapter.name != null &&
                      SUGGESTED_SOLANA_NAMES.includes(w.adapter.name) &&
                      i ===
                        self.findIndex(
                          (x) => x.adapter.name === w.adapter.name,
                        ),
                  )
                  .map((wallet, index) => (
                    <WalletOption
                      disabled={connecting}
                      isDetected={
                        wallet.readyState === WalletReadyState.Installed
                      }
                      key={`${wallet.adapter.name ?? ""}-${index}`}
                      onClick={() => handleSelectWallet(wallet)}
                      wallet={wallet}
                    />
                  ))}
                {!solanaOnly && (
                  <EthereumOptionButton
                    disabled={connecting}
                    icon={ETHEREUM_WALLET_OPTIONS[1].icon}
                    isDetected={isMetaMaskDetected}
                    name="MetaMask"
                    onClick={() => handleSelectEthereumOption("injected")}
                  />
                )}
              </div>
              <p
                className={`
                  text-xs font-medium tracking-wider text-muted-foreground
                  uppercase
                `}
              >
                Others
              </p>
              <div className="flex flex-col gap-2">
                {solanaWallets
                  .filter(
                    (wallet, index, self) =>
                      wallet.adapter.name != null &&
                      !SUGGESTED_SOLANA_NAMES.includes(wallet.adapter.name) &&
                      index ===
                        self.findIndex(
                          (w) => w.adapter.name === wallet.adapter.name,
                        ),
                  )
                  .map((wallet, index) => (
                    <WalletOption
                      disabled={connecting}
                      isDetected={
                        wallet.readyState === WalletReadyState.Installed
                      }
                      key={`${wallet.adapter.name ?? ""}-${index}`}
                      onClick={() => handleSelectWallet(wallet)}
                      wallet={wallet}
                    />
                  ))}
                {!solanaOnly &&
                  ETHEREUM_WALLET_OPTIONS.filter(
                    (o) =>
                      o.name !== "MetaMask" &&
                      !SOLANA_WALLET_NAMES_TO_SKIP.includes(o.name),
                  ).map((opt) => (
                    <EthereumOptionButton
                      disabled={connecting}
                      icon={opt.icon}
                      key={opt.name}
                      name={opt.name}
                      onClick={() =>
                        handleSelectEthereumOption(
                          opt.id === "walletconnect"
                            ? "walletconnect"
                            : "injected",
                        )
                      }
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
                      : selectedChain === "solana" && solanaChallengePending
                        ? "Click the button below to open your wallet and sign the message."
                        : selectedChain === "solana"
                          ? "Preparing message…"
                          : `Open ${selectedWallet?.adapter.name ?? "your wallet"} to sign and complete sign-in.`}
                  </p>
                  {selectedChain === "solana" &&
                    solanaChallengePending != null && (
                      <Button
                        className="mt-4"
                        disabled={solanaSigning}
                        onClick={handleSolanaSignClick}
                        type="button"
                      >
                        {solanaSigning
                          ? "Signing…"
                          : "Sign message in your wallet"}
                      </Button>
                    )}
                </>
              )}
              {step === "error" && (
                <button
                  className={`
                    mt-2 text-sm text-primary
                    hover:underline
                  `}
                  onClick={handleTryAgain}
                  type="button"
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

function WalletOption({
  disabled,
  isDetected,
  onClick,
  wallet,
}: {
  disabled: boolean;
  isDetected: boolean;
  onClick: () => void;
  wallet: SolanaWalletOption;
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
            flex size-8 shrink-0 items-center justify-center overflow-hidden
            rounded-md bg-muted/20
          `}
        >
          <Image
            alt=""
            className="object-contain"
            height={32}
            src={icon}
            unoptimized
            width={32}
          />
        </div>
      )}
      <span className="flex-1 font-medium">
        {wallet.adapter.name ?? "Wallet"}
      </span>
      {isDetected && (
        <span
          className={`
            rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium
            text-green-700
            dark:text-green-400
          `}
        >
          Detected
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
