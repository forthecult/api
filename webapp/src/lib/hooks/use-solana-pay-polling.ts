"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type SolanaPayStatus =
  | "confirmed"
  | "connection-error"
  | "error"
  | "idle"
  | "polling";

interface UseSolanaPayPollingOptions {
  /** Amount as string (already formatted for the token's decimals) */
  amount: null | string;
  /** Deposit address to poll for payments */
  depositAddress: null | string;
  /** Whether to enable polling */
  enabled: boolean;
  /** Callback when payment is confirmed (receives orderId; called before redirect unless skipRedirect) */
  onConfirmed?: (orderId: string) => void;
  /** Order ID for confirmation */
  orderId: null | string;
  /** Payer wallet address (so we can link order to user when they sign up later) */
  payerWalletAddress?: null | string;
  /** Polling interval in ms (default: 1500) */
  pollInterval?: number;
  /** When true, do not call router.push; caller handles navigation via onConfirmed */
  skipRedirect?: boolean;
  /** SPL token mint address */
  splToken: null | string;
  /** Custom success redirect URL (used only when skipRedirect is false) */
  successUrl?: string;
}

interface UseSolanaPayPollingResult {
  signature: null | string;
  status: SolanaPayStatus;
  stopPolling: () => void;
}

/**
 * Shared hook for polling Solana Pay transaction status.
 * Used by both CheckoutClient and CryptoPayClient.
 */
export function useSolanaPayPolling({
  amount,
  depositAddress,
  enabled,
  onConfirmed,
  orderId,
  payerWalletAddress,
  pollInterval = 1500,
  skipRedirect = false,
  splToken,
  successUrl,
}: UseSolanaPayPollingOptions): UseSolanaPayPollingResult {
  const router = useRouter();
  const [status, setStatus] = useState<SolanaPayStatus>("idle");
  const [signature, setSignature] = useState<null | string>(null);
  const pollRef = useRef<null | ReturnType<typeof setInterval>>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Validate all required params before polling
    if (!enabled || !depositAddress || !orderId || !amount || !splToken) {
      setStatus("idle");
      return;
    }

    setStatus("polling");

    const params = new URLSearchParams({
      amount,
      depositAddress,
      splToken,
    });

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/solana-pay/status?${params.toString()}`,
        );
        const data = (await res.json()) as {
          message?: string;
          signature?: string;
          status: string;
        };

        if (data.status === "confirmed") {
          setStatus("confirmed");
          setSignature(data.signature || null);
          stopPolling();

          // Confirm order on server
          try {
            await fetch("/api/checkout/solana-pay/confirm", {
              body: JSON.stringify({
                amount,
                depositAddress,
                orderId,
                signature: data.signature,
                splToken,
                ...(payerWalletAddress?.trim()
                  ? { payerWalletAddress: payerWalletAddress.trim() }
                  : {}),
              }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
          } catch {
            // order stays pending; can be reconciled later
          }

          onConfirmed?.(orderId);

          if (!skipRedirect) {
            const url =
              successUrl ||
              `/checkout/success?orderId=${encodeURIComponent(orderId)}`;
            router.push(url);
          }
          return;
        }

        if (data.status === "error") {
          setStatus("error");
          stopPolling();
          return;
        }

        // status === "pending" -> keep polling
      } catch {
        setStatus("connection-error");
        stopPolling();
      }
    }, pollInterval);

    pollRef.current = interval;

    return () => {
      stopPolling();
    };
  }, [
    enabled,
    depositAddress,
    orderId,
    amount,
    splToken,
    pollInterval,
    onConfirmed,
    successUrl,
    skipRedirect,
    router,
    stopPolling,
    payerWalletAddress?.trim,
  ]);

  return {
    signature,
    status,
    stopPolling,
  };
}
