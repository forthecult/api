/**
 * Secure localStorage wrapper with encryption for sensitive data
 *
 * Uses AES-GCM encryption via the Web Crypto API to protect PII and other
 * sensitive data stored in localStorage. The encryption key is derived from
 * a combination of a static app secret and a per-session random component.
 *
 * Security notes:
 * - This provides protection against casual inspection and some XSS attacks
 * - It does NOT protect against determined attackers with full browser access
 * - For truly sensitive data, avoid client-side storage entirely
 * - The encryption key is stored in sessionStorage (cleared on tab close)
 */

// Prefix for encrypted storage keys
const ENCRYPTED_PREFIX = "__enc_";

// Session key storage
const SESSION_KEY_NAME = "__enc_session_key";

// App-level entropy (should be set via env var in production)
const APP_ENTROPY =
  typeof process.env.NEXT_PUBLIC_STORAGE_ENTROPY === "string"
    ? process.env.NEXT_PUBLIC_STORAGE_ENTROPY
    : "default-entropy-change-in-production";

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(encryptedData: string): Promise<string> {
  const key = await getOrCreateSessionKey();

  // Decode from base64
  const combined = new Uint8Array(
    atob(encryptedData)
      .split("")
      .map((c) => c.charCodeAt(0)),
  );

  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await window.crypto.subtle.decrypt(
    { iv, name: "AES-GCM" },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(data: string): Promise<string> {
  const key = await getOrCreateSessionKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);

  const encrypted = await window.crypto.subtle.encrypt(
    { iv: iv as BufferSource, name: "AES-GCM" },
    key,
    encoded as BufferSource,
  );

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Generate or retrieve the session encryption key
 * Key is stored in sessionStorage so it's cleared when the tab closes
 */
async function getOrCreateSessionKey(): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API not available");
  }

  // Check for existing session key
  const existingKeyData = sessionStorage.getItem(SESSION_KEY_NAME);
  if (existingKeyData) {
    try {
      const keyData = JSON.parse(existingKeyData) as {
        iv: number[];
        key: number[];
      };
      return await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(keyData.key),
        { length: 256, name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"],
      );
    } catch {
      // Key corrupted, regenerate
      sessionStorage.removeItem(SESSION_KEY_NAME);
    }
  }

  // Generate new key material (cast for BufferSource - Uint8Array may use ArrayBufferLike in types)
  const keyMaterialBytes = new TextEncoder().encode(
    APP_ENTROPY + navigator.userAgent,
  );
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    keyMaterialBytes as unknown as BufferSource,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  // Derive encryption key (cast for BufferSource - Uint8Array may use ArrayBufferLike in types)
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const saltBuf: BufferSource = salt as unknown as BufferSource;
  const key = await window.crypto.subtle.deriveKey(
    {
      hash: "SHA-256",
      iterations: 100000,
      name: "PBKDF2",
      salt: saltBuf,
    },
    keyMaterial,
    { length: 256, name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  );

  // Export and store key data
  const exportedKey = await window.crypto.subtle.exportKey("raw", key);
  sessionStorage.setItem(
    SESSION_KEY_NAME,
    JSON.stringify({
      key: Array.from(new Uint8Array(exportedKey)),
      salt: Array.from(salt),
    }),
  );

  return key;
}

/**
 * Secure storage interface for sensitive data
 */
export const secureStorage = {
  /**
   * Clear all encrypted storage items
   */
  clear(): void {
    if (typeof window === "undefined") return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(ENCRYPTED_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem(SESSION_KEY_NAME);
  },

  /**
   * Retrieve and decrypt data from localStorage
   * @param key Storage key
   * @returns Decrypted value or null if not found
   */
  async getItem(key: string): Promise<null | string> {
    if (typeof window === "undefined") return null;

    // Try encrypted storage first
    const encrypted = localStorage.getItem(ENCRYPTED_PREFIX + key);
    if (encrypted) {
      try {
        return await decrypt(encrypted);
      } catch (error) {
        console.error("[SecureStorage] Failed to decrypt:", error);
        // Remove corrupted data
        localStorage.removeItem(ENCRYPTED_PREFIX + key);
      }
    }

    // Fallback: check for unencrypted data (migration path)
    const unencrypted = localStorage.getItem(key);
    if (unencrypted) {
      // Migrate to encrypted storage
      try {
        await secureStorage.setItem(key, unencrypted);
        localStorage.removeItem(key);
        return unencrypted;
      } catch {
        return unencrypted;
      }
    }

    return null;
  },

  /**
   * Remove data from localStorage (both encrypted and unencrypted)
   * @param key Storage key
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ENCRYPTED_PREFIX + key);
    localStorage.removeItem(key);
  },

  /**
   * Store encrypted data in localStorage
   * @param key Storage key
   * @param value Value to encrypt and store
   */
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === "undefined") return;

    try {
      const encrypted = await encrypt(value);
      localStorage.setItem(ENCRYPTED_PREFIX + key, encrypted);
    } catch (error) {
      console.error(
        "[SecureStorage] Failed to encrypt — data NOT stored to avoid plaintext leak:",
        error,
      );
      // [SECURITY] Do NOT fallback to unencrypted storage; sensitive data must not be stored in plaintext.
      // Callers should handle the async rejection or missing data gracefully.
    }
  },
};

/**
 * Synchronous secure storage for compatibility with existing code
 * Uses a cached decryption approach - data is decrypted on first access
 * and cached in memory for the session.
 */
const decryptionCache = new Map<string, string>();

export const secureStorageSync = {
  /**
   * Get data - returns cached value or attempts sync decryption
   * For sensitive data, prefer the async version
   */
  getItem(key: string): null | string {
    if (typeof window === "undefined") return null;

    // Check cache first
    const cached = decryptionCache.get(key);
    if (cached !== undefined) return cached;

    // Check for unencrypted data (migration path or fallback)
    const unencrypted = localStorage.getItem(key);
    if (unencrypted) {
      decryptionCache.set(key, unencrypted);
      // Migrate in background
      secureStorage
        .setItem(key, unencrypted)
        .then(() => {
          localStorage.removeItem(key);
        })
        .catch(() => {});
      return unencrypted;
    }

    // Trigger async decryption for next access
    const encrypted = localStorage.getItem(ENCRYPTED_PREFIX + key);
    if (encrypted) {
      secureStorage
        .getItem(key)
        .then((value) => {
          if (value) decryptionCache.set(key, value);
        })
        .catch(() => {});
      // Return null for first access - caller should handle loading state
      return null;
    }

    return null;
  },

  /**
   * Initialize cache by decrypting stored data
   * Call this on app startup for keys you'll need synchronously
   */
  async preload(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const value = await secureStorage.getItem(key);
        if (value) decryptionCache.set(key, value);
      }),
    );
  },

  removeItem(key: string): void {
    decryptionCache.delete(key);
    secureStorage.removeItem(key);
  },

  /**
   * Store data (encrypts asynchronously in background)
   */
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;

    // Update cache immediately
    decryptionCache.set(key, value);

    // Encrypt and store in background
    secureStorage.setItem(key, value).catch((error) => {
      console.error("[SecureStorageSync] Background encryption failed:", error);
    });
  },
};

export default secureStorage;
