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
  /** Called after payment is confirmed and before redirect. */
  onComplete?: (orderId: null | string) => void;
  total: number;
}

export interface UseSolanaPayCheckoutResult {
  amountUsd: number;
  closeDialog: () => void;
  open: boolean;
  openDialog: () => Promise<void>;
  orderId: null | string;
  paymentUrl: null | string;
  recipientAddress: null | string;
  status: SolanaPayStatus;
}

/**
 * Manages Solana Pay in-page flow: create order, show QR, poll for confirmation.
 * Fires onComplete(orderId) when payment is confirmed; caller typically redirects.
 */
export function useSolanaPayCheckout({
  buildOrderPayload,
  onComplete,
  total,
}: UseSolanaPayCheckoutArgs): UseSolanaPayCheckoutResult {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<null | string>(null);
  const [orderId, setOrderId] = useState<null | string>(null);
  const [recipientAddress, setRecipientAddress] = useState<null | string>(null);
  const [amountStr, setAmountStr] = useState<null | string>(null);
  const [splToken, setSplToken] = useState<null | string>(null);

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
    amount: amountStr,
    depositAddress: recipientAddress,
    enabled: open && !!recipientAddress && !!amountStr && !!splToken,
    onConfirmed: handleConfirmed,
    orderId,
    skipRedirect: true,
    splToken,
  });

  const openDialog = useCallback(async () => {
    const { commonBody, form, orderTotalCents } = buildOrderPayload();
    setOpen(true);
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        body: JSON.stringify({
          ...commonBody,
          // Include shipping address (was previously missing from QR dialog flow)
          ...(form?.street?.trim()
            ? {
                shipping: {
                  address1: form.street,
                  address2: form.apartment,
                  city: form.city,
                  countryCode: form.country,
                  name: `${form.firstName ?? ""} ${form.lastName ?? ""}`.trim(),
                  phone: form.phone,
                  stateCode: form.state,
                  zip: form.zip,
                },
              }
            : {}),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!createRes.ok) {
        setOpen(false);
        // 429 is rate limit; user can retry after a short wait (no need to surface in dialog)
        return;
      }
      const data = (await createRes.json()) as {
        confirmationToken?: string;
        depositAddress: string;
        orderId: string;
      };
      const { confirmationToken, depositAddress, orderId: id } = data;
      if (confirmationToken) {
        try {
          sessionStorage.setItem(`checkout_ct_${id}`, confirmationToken);
        } catch {}
      }
      const amount = usdcAmountFromUsd(orderTotalCents / 100);
      const url = encodeURL({
        amount,
        label: getSolanaPayLabel(),
        message: `Order total: $${total.toFixed(2)}`,
        recipient: new PublicKey(depositAddress),
        splToken: new PublicKey(USDC_MINT_MAINNET),
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
    amountUsd: total,
    closeDialog,
    open,
    openDialog,
    orderId,
    paymentUrl,
    recipientAddress,
    status,
  };
}
