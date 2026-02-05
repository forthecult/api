/**
 * Sui Payment Kit helpers for checkout.
 * Uses the standard Sui Payment Kit (ephemeral payments via sui:pay URIs).
 * @see https://docs.sui.io/standards/payment-kit
 * @see https://sdk.mystenlabs.com/payment-kit
 */

import { createPaymentTransactionUri } from "@mysten/payment-kit";

export const SUI_COIN_TYPE = "0x2::sui::SUI";
export const MIST_PER_SUI = 1_000_000_000n;

export function getSuiPayRecipient(): string | undefined {
  return typeof process.env.NEXT_PUBLIC_SUI_PAY_RECIPIENT === "string"
    ? process.env.NEXT_PUBLIC_SUI_PAY_RECIPIENT.trim() || undefined
    : undefined;
}

export function getSuiPayLabel(): string {
  return typeof process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL === "string"
    ? process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL.trim()
    : "Culture";
}

/**
 * Build a Sui Payment Kit transaction URI (ephemeral payment).
 * Omit registry to use ephemeral; wallets will call process_ephemeral_payment.
 */
export function createSuiPayUri(params: {
  receiverAddress: string;
  amountMist: bigint;
  nonce: string;
  label?: string;
  message?: string;
}): string {
  return createPaymentTransactionUri({
    receiverAddress: params.receiverAddress,
    amount: params.amountMist,
    coinType: SUI_COIN_TYPE,
    nonce: params.nonce,
    label: params.label,
    message: params.message,
  });
}
