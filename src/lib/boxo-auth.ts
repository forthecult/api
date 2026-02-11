/**
 * Verify Boxo server-to-server requests using Authorization header.
 * Boxo sends: Authorization: <prefix> <base64(client_id:client_secret)>
 * Prefix is configurable in dashboard (default "Token").
 */

import crypto from "node:crypto";

const BOXO_CLIENT_ID = process.env.BOXO_CLIENT_ID ?? process.env.NEXT_PUBLIC_BOXO_CLIENT_ID ?? "";
const BOXO_SECRET_KEY = process.env.BOXO_SECRET_KEY ?? "";
const BOXO_ACCESS_TOKEN_PREFIX = process.env.BOXO_ACCESS_TOKEN_PREFIX ?? "Token";

export function getBoxoCredentials(): { clientId: string; secretKey: string } {
  return { clientId: BOXO_CLIENT_ID, secretKey: BOXO_SECRET_KEY };
}

export function isBoxoConfigured(): boolean {
  return Boolean(BOXO_CLIENT_ID && BOXO_SECRET_KEY);
}

/**
 * Verify Authorization header from Boxo (for Connect and Payments callbacks).
 * Expects: "<prefix> <base64(client_id:client_secret)>"
 */
export function verifyBoxoAuthorization(authHeader: string | null): boolean {
  if (!authHeader?.trim() || !BOXO_CLIENT_ID || !BOXO_SECRET_KEY) return false;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 2) return false;
  const prefix = parts[0];
  const encoded = parts[1];
  if (prefix !== BOXO_ACCESS_TOKEN_PREFIX || !encoded) return false;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const [clientId, secretKey] = decoded.split(":");
    const clientIdMatch = clientId.length === BOXO_CLIENT_ID.length &&
      crypto.timingSafeEqual(Buffer.from(clientId, "utf8"), Buffer.from(BOXO_CLIENT_ID, "utf8"));
    const secretMatch = secretKey.length === BOXO_SECRET_KEY.length &&
      crypto.timingSafeEqual(Buffer.from(secretKey, "utf8"), Buffer.from(BOXO_SECRET_KEY, "utf8"));
    return clientIdMatch && secretMatch;
  } catch {
    return false;
  }
}
