/**
 * Client-safe Solana transaction helpers.
 * Used for decoding base64-encoded transactions from prepare APIs.
 */

/** Decode a base64-encoded transaction payload to Uint8Array. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
