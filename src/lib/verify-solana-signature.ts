/**
 * Verify a Solana wallet signed a message (ed25519).
 * Used for token-gate and tier verification.
 */

import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

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

export function verifySolanaSignature(params: {
  address: string;
  message: string;
  signature?: string;
  signatureBase58?: string;
}): boolean {
  const signature = getSignatureBytes(params);
  if (!signature || signature.length !== 64) return false;
  try {
    const publicKey = new PublicKey(params.address);
    const publicKeyBytes = publicKey.toBytes();
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes);
  } catch {
    return false;
  }
}
