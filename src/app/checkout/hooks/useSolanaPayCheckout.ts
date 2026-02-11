"use client";

import { encodeURL } from "@solana/pay";
import { PublicKey } from "@solana/web3-compat";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { SolanaPayStatus } from "~/lib/hooks/use-solana-pay-polling";
import { useSolanaPayPolling } from "~/lib/hooks/use-solana-pay-polling";
import {
  getSolanaPayLabel,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
} from "~/lib/solana-pay";
import type { OrderPayload } from "../checkout-shared";

export interface UseSolanaPayCheckoutArgs {
  buildOrderPayload: () => OrderPayload;
  total: number;
  /** Called after payment is confirmed and before redirect. */
  onComplete?: (orderId: string | null) => void;
}

export interface UseSolanaPayCheckoutResult {
  open: boolean;
  openDialog: () => Promise<void>;
  closeDialog: () => void;
  paymentUrl: string | null;
  status: SolanaPayStatus;
  orderId: string | null;
  amountUsd: number;
  recipientAddress: string | null;
}

/**
 * Manages Solana Pay in-page flow: create order, show QR, poll for confirmation.
 * Fires onComplete(orderId) when payment is confirmed; caller typically redirects.
 */
export function useSolanaPayCheckout({
  buildOrderPayload,
  total,
  onComplete,
}: UseSolanaPayCheckoutArgs): UseSolanaPayCheckoutResult {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState<string | null>(null);
  const [splToken, setSplToken] = useState<string | null>(null);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setPaymentUrl(null);
    setOrderId(null);
    setRecipientAddress(null);
    setAmountStr(null);
    setSplToken(null);
  }, []);

  const handleConfirmed = useCallback(
    (id: string) => {
      closeDialog();
      onComplete?.(id);
      router.push(
        id
          ? `/checkout/success?orderId=${encodeURIComponent(id)}`
          : "/checkout/success",
      );
    },
    [closeDialog, onComplete, router],
  );

  const { status } = useSolanaPayPolling({
    depositAddress: recipientAddress,
    orderId,
    amount: amountStr,
    splToken,
    enabled: open && !!recipientAddress && !!amountStr && !!splToken,
    onConfirmed: handleConfirmed,
    skipRedirect: true,
  });

  const openDialog = useCallback(async () => {
    const { orderTotalCents, commonBody, form } = buildOrderPayload();
    setOpen(true);
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...commonBody,
          // Include shipping address (was previously missing from QR dialog flow)
          ...(form?.street?.trim()
            ? {
                shipping: {
                  name: `${form.firstName ?? ""} ${form.lastName ?? ""}`.trim(),
                  address1: form.street,
                  address2: form.apartment,
                  city: form.city,
                  stateCode: form.state,
                  countryCode: form.country,
                  zip: form.zip,
                  phone: form.phone,
                },
              }
            : {}),
        }),
      });
      if (!createRes.ok) {
        setOpen(false);
        return;
      }
      const data = (await createRes.json()) as {
        orderId: string;
        depositAddress: string;
        confirmationToken?: string;
      };
      const { orderId: id, depositAddress, confirmationToken } = data;
      if (confirmationToken) {
        try { sessionStorage.setItem(`checkout_ct_${id}`, confirmationToken); } catch {}
      }
      const amount = usdcAmountFromUsd(orderTotalCents / 100);
      const url = encodeURL({
        recipient: new PublicKey(depositAddress),
        amount,
        splToken: new PublicKey(USDC_MINT_MAINNET),
        label: getSolanaPayLabel(),
        message: `Order total: $${total.toFixed(2)}`,
      });
      setPaymentUrl(url.toString());
      setOrderId(id);
      setRecipientAddress(depositAddress);
      setAmountStr(amount.toString());
      setSplToken(USDC_MINT_MAINNET);
    } catch {
      setOpen(false);
    }
  }, [buildOrderPayload, total]);

  return {
    open,
    openDialog,
    closeDialog,
    paymentUrl,
    status,
    orderId,
    amountUsd: total,
    recipientAddress,
  };
}
