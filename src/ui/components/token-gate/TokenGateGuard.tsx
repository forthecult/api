"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Wallet } from "@solana/wallet-adapter-react";
import { Lock, Wallet as WalletIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Spinner } from "~/ui/primitives/spinner";

const API_BASE =
  typeof window !== "undefined"
    ? window.location.origin
    : typeof process.env.NEXT_PUBLIC_APP_URL === "string"
      ? process.env.NEXT_PUBLIC_APP_URL
      : "";

export type TokenGateResourceType = "product" | "category" | "page";

type TokenGateConfig = {
  tokenGated: boolean;
  gates: Array<{ tokenSymbol: string; quantity: number; network: string | null; gateType: string }>;
};

type TokenGateGuardProps = {
  resourceType: TokenGateResourceType;
  resourceId: string;
  /** When omitted or null, only the gate UI is shown (e.g. product page when not passed). */
  children?: React.ReactNode;
  /** Optional class for the gated overlay container */
  className?: string;
  /** When provided and user validates with no children, called instead of router.refresh (e.g. close modal and navigate). */
  onValidated?: () => void;
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
          <img src={icon} alt="" className="object-contain" width={32} height={32} />
        </div>
      )}
      <span className="flex-1 font-medium">{wallet.adapter.name}</span>
      {isDetected && (
        <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          Detected
        </span>
      )}
    </button>
  );
}

export function TokenGateGuard({
  resourceType,
  resourceId,
  children,
  className,
  onValidated,
}: TokenGateGuardProps) {
  const router = useRouter();
  const [config, setConfig] = useState<TokenGateConfig | null>(null);
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"connect" | "signing" | "error">("connect");
  const [error, setError] = useState("");
  const signFlowStarted = useRef(false);
  const hasChildren = React.Children.count(children) > 0;

  const {
    wallets,
    select,
    connect,
    publicKey,
    connected,
    signMessage,
  } = useWallet();

  const solanaWallets = wallets.filter(
    (w) =>
      w.readyState === WalletReadyState.Installed ||
      w.readyState === WalletReadyState.Loadable,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/token-gate?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`,
        );
        if (!res.ok) throw new Error("Failed to load token gate config");
        const data = (await res.json()) as { data?: TokenGateConfig };
        const gateConfig = data.data ?? (data as unknown as TokenGateConfig);
        if (!cancelled) setConfig(gateConfig);
      } catch (e) {
        if (!cancelled) setConfig({ tokenGated: false, gates: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceType, resourceId]);

  const handleSelectWallet = useCallback(
    async (wallet: Wallet) => {
      setError("");
      try {
        select(wallet.adapter.name);
        await new Promise((r) => setTimeout(r, 150));
        await connect();
        setStep("signing");
      } catch {
        setError("Connection failed. Try again or use another wallet.");
      }
    },
    [select, connect],
  );

  useEffect(() => {
    if (!config?.tokenGated || step !== "signing" || !connected || !publicKey || !signMessage) return;
    if (signFlowStarted.current) return;
    signFlowStarted.current = true;
    let cancelled = false;

    (async () => {
      try {
        const address = publicKey.toBase58();

        const challengeRes = await fetch(`${API_BASE}/api/token-gate/challenge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            resourceType,
            resourceId,
          }),
        });
        if (!challengeRes.ok) throw new Error("Failed to get challenge");
        const { message } = (await challengeRes.json()) as { message: string };
        if (cancelled) return;

        const messageBytes = new TextEncoder().encode(message);
        const rawResult = await signMessage(messageBytes);
        if (cancelled) return;

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
                  ? new Uint8Array((sig as Uint8Array).buffer.slice((sig as Uint8Array).byteOffset, (sig as Uint8Array).byteOffset + (sig as Uint8Array).byteLength))
                  : null;
        const signatureBase64 =
          bytes != null
            ? typeof Buffer !== "undefined"
              ? Buffer.from(bytes).toString("base64")
              : btoa(String.fromCharCode.apply(null, Array.from(bytes)))
            : undefined;
        const signatureBase58 = isBase58 && typeof sig === "string" ? sig : undefined;
        if (!signatureBase64 && !signatureBase58) {
          throw new Error("Could not read signature from wallet.");
        }

        const validateRes = await fetch(`${API_BASE}/api/token-gate/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            message,
            ...(signatureBase64 ? { signature: signatureBase64 } : {}),
            ...(signatureBase58 ? { signatureBase58 } : {}),
            resourceType,
            resourceId,
          }),
        });
        const validateData = (await validateRes.json()) as {
          valid?: boolean;
          error?: string;
        };
        if (cancelled) return;

        if (validateData.valid) {
          setValidated(true);
          setError("");
        } else {
          setError(
            validateData.error ??
              "We couldn't verify your token balance. Connect the wallet that holds the required tokens and try again.",
          );
          setStep("error");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Verification failed");
          setStep("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config?.tokenGated, step, connected, publicKey, signMessage, resourceType, resourceId]);

  // When we were rendered without children (server sent gate shell only), after validation refresh or notify parent.
  useEffect(() => {
    if (validated && !hasChildren) {
      if (onValidated) {
        onValidated();
      } else {
        router.refresh();
      }
    }
  }, [validated, hasChildren, router, onValidated]);

  if (loading) {
    return (
      <div className={cn("flex min-h-[280px] items-center justify-center", className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!config?.tokenGated || validated) {
    // When server sent guard with no children and this resource isn't gated, refresh so server can send full content
    if (!hasChildren && !config?.tokenGated) {
      router.refresh();
      return (
        <div className="flex min-h-[280px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }
    return <>{children}</>;
  }

  /** Format network for display: "the Solana network", "the Ethereum network", or "EVM (Ethereum, Base, …)". */
  function formatNetwork(network: string | null): string {
    const n = (network ?? "solana").toLowerCase();
    switch (n) {
      case "solana":
        return "the Solana network";
      case "ethereum":
        return "the Ethereum network";
      case "base":
        return "the Base network";
      case "arbitrum":
        return "the Arbitrum network";
      case "bnb":
      case "bsc":
        return "the BNB Chain network";
      case "polygon":
        return "the Polygon network";
      case "avalanche":
        return "the Avalanche network";
      default:
        return n ? `the ${n} network` : "the required network";
    }
  }

  /** Build requirement text with network: "≥ 1000 CRUST on the Solana network" or "… or … on EVM (Ethereum, Base)". */
  const gateSummary =
    config.gates.length > 0
      ? (() => {
          const parts = config.gates.map(
            (g) => `≥ ${g.quantity} ${g.tokenSymbol} on ${formatNetwork(g.network)}`,
          );
          if (parts.length === 1) return parts[0];
          return parts.join(", or ");
        })()
      : "required tokens";

  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center px-4 py-12",
        className,
      )}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold">Token-gated content</h2>
          <p className="text-base text-muted-foreground">
            Connect your wallet and sign to verify you hold the required tokens
            to view this page. You need: {gateSummary}.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "connect" && (
          <div className="space-y-3">
            {solanaWallets.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No Solana wallet detected. Install Phantom or another supported
                wallet.
              </p>
            ) : (
              <div className="grid gap-2">
                {solanaWallets
                  .filter(
                    (wallet, index, self) =>
                      index ===
                      self.findIndex(
                        (w) => w.adapter.name === wallet.adapter.name,
                      ),
                  )
                  .map((wallet) => (
                    <WalletOption
                      key={wallet.adapter.name}
                      wallet={wallet}
                      onClick={() => handleSelectWallet(wallet)}
                      disabled={false}
                      isDetected={
                        wallet.readyState === WalletReadyState.Installed
                      }
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {step === "signing" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Spinner variant="page" />
            <p className="text-center text-sm text-muted-foreground">
              Open your wallet to sign the message and verify your token
              balance.
            </p>
          </div>
        )}

        {step === "error" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep("connect");
              setError("");
              signFlowStarted.current = false;
            }}
          >
            <WalletIcon className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
