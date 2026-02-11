/**
 * Server-side verification of Telegram WebApp initData.
 *
 * Telegram Mini Apps send a signed `initData` string that must be verified
 * using the bot token HMAC to ensure the data hasn't been tampered with.
 *
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

import crypto from "node:crypto";

/**
 * Verify Telegram WebApp initData using HMAC-SHA256.
 *
 * @param initData - The raw initData string from `window.Telegram.WebApp.initData`
 * @param botToken - The Telegram bot token (from TELEGRAM_BOT_TOKEN env var)
 * @returns The parsed user data if valid, or null if verification fails
 */
export function verifyTelegramInitData(
  initData: string,
  botToken?: string,
): { id: number; username?: string; first_name?: string; last_name?: string } | null {
  const token = botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    // Remove hash from the data check string
    params.delete("hash");

    // Sort parameters alphabetically and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Compute HMAC: secret_key = HMAC_SHA256("WebAppData", bot_token)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(checkString)
      .digest("hex");

    // Timing-safe comparison
    if (
      computedHash.length !== hash.length ||
      !crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))
    ) {
      return null;
    }

    // Parse user data
    const userStr = params.get("user");
    if (!userStr) return null;

    const user = JSON.parse(userStr) as {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };

    return user;
  } catch {
    return null;
  }
}
