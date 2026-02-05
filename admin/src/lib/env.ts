/**
 * Main app URL for admin (links to store, API calls).
 * Falls back to NEXT_PUBLIC_APP_URL so you only need one main URL in .env.
 */
export function getMainAppUrl(): string {
  const u =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return u || "http://localhost:3000";
}
