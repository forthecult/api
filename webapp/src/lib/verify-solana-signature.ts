/**
 * verify a solana wallet signed a message (ed25519).
 * used for token-gate and tier verification.
 *
 * kit-native: uses webcrypto ed25519 via @solana/kit
 * (`getPublicKeyFromAddress` + `verifySignature`). this is why the function
 * is async — `crypto.subtle.verify` returns a promise. requires node 20+
 * (we run 22) or any modern browser/edge runtime with subtlecrypto ed25519.
 */

import {
  address,
  getPublicKeyFromAddress,
  type SignatureBytes,
  verifySignature,
} from "@solana/kit";
import bs58 from "bs58";

export async function verifySolanaSignature(params: {
  address: string;
  message: string;
  signature?: string;
  signatureBase58?: string;
}): Promise<boolean> {
  const sig = getSignatureBytes(params);
  if (!sig || sig.length !== 64) return false;
  try {
    const addr = address(params.address);
    const publicKey = await getPublicKeyFromAddress(addr);
    const messageBytes = new TextEncoder().encode(params.message);
    return await verifySignature(
      publicKey,
      sig as SignatureBytes,
      messageBytes,
    );
  } catch {
    return false;
  }
}

function getSignatureBytes(params: {
  signature?: string;
  signatureBase58?: string;
}): null | Uint8Array {
  if (params.signatureBase58) {
    try {
      const decoded = bs58.decode(params.signatureBase58);
      if (decoded.length < 64) return null;
      return decoded.length === 64 ? decoded : decoded.slice(0, 64);
    } catch {
      return null;
    }
  }
  if (params.signature) {
    try {
      const buf = Buffer.from(params.signature, "base64");
      if (buf.length < 64) return null;
      return new Uint8Array(buf.length === 64 ? buf : buf.subarray(0, 64));
    } catch {
      return null;
    }
  }
  return null;
}
