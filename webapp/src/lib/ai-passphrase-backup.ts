/**
 * Client-side encryption for `/api/ai/backup` payloads (AES-256-GCM + PBKDF2).
 * The server stores ciphertext only; passphrase never leaves the browser.
 */

const PBKDF2_ITERATIONS = 250_000;

export interface EncryptedBackupWire {
  algorithm: "aes-256-gcm-pbkdf2-sha256";
  ciphertext: string;
  keyDerivation: {
    iterations: number;
    saltB64: string;
  };
  nonce: string;
}

export async function decryptBackupPlaintext(
  wire: EncryptedBackupWire,
  passphrase: string,
): Promise<string> {
  const salt = b64ToBytes(wire.keyDerivation.saltB64);
  const iv = b64ToBytes(wire.nonce);
  const key = await deriveAesKey(passphrase, salt);
  const ct = b64ToBytes(wire.ciphertext);
  const pt = await crypto.subtle.decrypt(
    { iv: iv as BufferSource, name: "AES-GCM", tagLength: 128 },
    key,
    ct as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

export async function encryptBackupPlaintext(
  plaintextUtf8: string,
  passphrase: string,
): Promise<EncryptedBackupWire> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const data = new TextEncoder().encode(plaintextUtf8);
  const ct = await crypto.subtle.encrypt(
    { iv: iv as BufferSource, name: "AES-GCM", tagLength: 128 },
    key,
    data as BufferSource,
  );
  const ciphertext = bytesToB64(new Uint8Array(ct));
  return {
    algorithm: "aes-256-gcm-pbkdf2-sha256",
    ciphertext,
    keyDerivation: {
      iterations: PBKDF2_ITERATIONS,
      saltB64: bytesToB64(salt),
    },
    nonce: bytesToB64(iv),
  };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(passphrase);
  const base = await crypto.subtle.importKey("raw", enc, "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      hash: "SHA-256",
      iterations: PBKDF2_ITERATIONS,
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
    },
    base,
    { length: 256, name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
