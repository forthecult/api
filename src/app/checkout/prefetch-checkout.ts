/**
 * Prefetch checkout and payment client chunks so they're in cache when the user
 * navigates. Call when the user shows intent (e.g. opens cart, hovers checkout,
 * or selects a payment method).
 */

import { preloadStripe } from "./stripe-preload";

let checkoutPrefetched = false;
let cryptoPayPrefetched = false;
let ethPayPrefetched = false;
let btcPayPrefetched = false;
let tonPayPrefetched = false;

export function prefetchCheckout(): void {
  if (checkoutPrefetched || typeof window === "undefined") return;
  checkoutPrefetched = true;
  void import("~/app/checkout/CheckoutClient");
  // Preload payment card chunk so credit card UI is ready as soon as checkout loads
  void import("~/app/checkout/components/PaymentMethodSection");
  // Start loading Stripe as soon as checkout intent is shown so the card form is ready when they select it
  preloadStripe();
}

export function prefetchCryptoPayClient(): void {
  if (cryptoPayPrefetched || typeof window === "undefined") return;
  cryptoPayPrefetched = true;
  void import("~/app/checkout/crypto/CryptoPayClient");
  // Preload Solana wallet provider so it’s ready when user lands on payment page
  void import("~/app/checkout/crypto/SolanaWalletProvider");
}

export function prefetchEthPayClient(): void {
  if (ethPayPrefetched || typeof window === "undefined") return;
  ethPayPrefetched = true;
  void import("~/app/checkout/eth/EthPayClient");
}

export function prefetchBtcPayClient(): void {
  if (btcPayPrefetched || typeof window === "undefined") return;
  btcPayPrefetched = true;
  void import("~/app/checkout/btcpay/BtcPayClient");
}

export function prefetchTonPayClient(): void {
  if (tonPayPrefetched || typeof window === "undefined") return;
  tonPayPrefetched = true;
  void import("~/app/checkout/ton/TonPayClient");
}

/** Prefetch the payment client that will be used for /checkout/[invoiceId]. */
export function prefetchPaymentClient(type: "solana" | "eth" | "btcpay" | "ton"): void {
  switch (type) {
    case "solana":
      prefetchCryptoPayClient();
      break;
    case "eth":
      prefetchEthPayClient();
      break;
    case "btcpay":
      prefetchBtcPayClient();
      break;
    case "ton":
      prefetchTonPayClient();
      break;
  }
}
