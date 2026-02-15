/**
 * Sui Payment Kit helpers for checkout.
 * Uses the standard Sui Payment Kit (ephemeral payments via sui:pay URIs).
 * @see https://docs.sui.io/standards/payment-kit
 * @see https://sdk.mystenlabs.com/payment-kit
 */

import { createPaymentTransactionUri } from "@mysten/payment-kit";

export const SUI_COIN_TYPE = "0x2::sui::SUI";
export const MIST_PER_SUI = 1_000_000_000n;

/**
 * Build a Sui Payment Kit transaction URI (ephemeral payment).
 * Omit registry to use ephemeral; wallets will call process_ephemeral_payment.
 */
export function createSuiPayUri(params: {
  amountMist: bigint;
  label?: string;
  message?: string;
  nonce: string;
  receiverAddress: string;
}): string {
  return createPaymentTransactionUri({
    amount: params.amountMist,
    coinType: SUI_COIN_TYPE,
    label: params.label,
    message: params.message,
    nonce: params.nonce,
    receiverAddress: params.receiverAddress,
  });
}

export function getSuiPayLabel(): string {
  return typeof process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL === "string"
    ? process.env.NEXT_PUBLIC_SOLANA_PAY_LABEL.trim()
    : "For the Culture";
}

export function getSuiPayRecipient(): string | undefined {
  return typeof process.env.NEXT_PUBLIC_SUI_PAY_RECIPIENT === "string"
    ? process.env.NEXT_PUBLIC_SUI_PAY_RECIPIENT.trim() || undefined
    : undefined;
}
