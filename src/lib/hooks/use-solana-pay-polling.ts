"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type SolanaPayStatus =
  | "idle"
  | "polling"
  | "confirmed"
  | "error"
  | "connection-error";

interface UseSolanaPayPollingOptions {
  /** Deposit address to poll for payments */
  depositAddress: string | null;
  /** Order ID for confirmation */
  orderId: string | null;
  /** Amount as string (already formatted for the token's decimals) */
  amount: string | null;
  /** SPL token mint address */
  splToken: string | null;
  /** Whether to enable polling */
  enabled: boolean;
  /** Callback when payment is confirmed */
  onConfirmed?: () => void;
  /** Custom success redirect URL */
  successUrl?: string;
  /** Polling interval in ms (default: 1500) */
  pollInterval?: number;
  /** Payer wallet address (so we can link order to user when they sign up later) */
  payerWalletAddress?: string | null;
}

interface UseSolanaPayPollingResult {
  status: SolanaPayStatus;
  signature: string | null;
  stopPolling: () => void;
}

/**
 * Shared hook for polling Solana Pay transaction status.
 * Used by both CheckoutClient and CryptoPayClient.
 */
export function useSolanaPayPolling({
  depositAddress,
  orderId,
  amount,
  splToken,
  enabled,
  onConfirmed,
  successUrl,
  pollInterval = 1500,
  payerWalletAddress,
}: UseSolanaPayPollingOptions): UseSolanaPayPollingResult {
  const router = useRouter();
  const [status, setStatus] = useState<SolanaPayStatus>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      depositAddress,
      amount,
      splToken,
    });

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/solana-pay/status?${params.toString()}`,
        );
        const data = (await res.json()) as {
          status: string;
          message?: string;
          signature?: string;
        };

        if (data.status === "confirmed") {
          setStatus("confirmed");
          setSignature(data.signature || null);
          stopPolling();

          // Confirm order on server
          try {
            await fetch("/api/checkout/solana-pay/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                depositAddress,
                orderId,
                signature: data.signature,
                amount,
                splToken,
                ...(payerWalletAddress?.trim()
                  ? { payerWalletAddress: payerWalletAddress.trim() }
                  : {}),
              }),
            });
          } catch {
            // order stays pending; can be reconciled later
          }

          onConfirmed?.();

          // Navigate to success page
          const url =
            successUrl ||
            `/checkout/success?orderId=${encodeURIComponent(orderId)}`;
          router.push(url);
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
    router,
    stopPolling,
  ]);

  return {
    status,
    signature,
    stopPolling,
  };
}
