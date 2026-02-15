/**
 * Server-only: derive the deposit keypair for an order.
 * Use this to sweep funds from order deposit addresses (e.g. in a script or admin job).
 * Same derivation as create-order; do not import from client.
 *
 * To access/sweep crypto: import { deriveDepositKeypair } from "~/lib/solana-deposit",
 * then use the keypair (e.g. keypair.publicKey, keypair.secretKey) with @solana/web3.js
 * to build and send a transfer from that address to your main wallet. Run only in a
 * server context (API route, script, cron) so SOLANA_DEPOSIT_SECRET is never exposed.
 */

import { Keypair } from "@solana/web3.js";
import { createHash } from "node:crypto";

export function deriveDepositKeypair(orderId: string): Keypair {
  const secret = process.env.SOLANA_DEPOSIT_SECRET;
  if (!secret) {
    throw new Error(
      "SOLANA_DEPOSIT_SECRET environment variable is required for Solana payment processing",
    );
  }
  const seed = createHash("sha256")
    .update(orderId + secret)
    .digest();
  return Keypair.fromSeed(new Uint8Array(seed));
}

export function deriveDepositAddress(orderId: string): string {
  return deriveDepositKeypair(orderId).publicKey.toBase58();
}
