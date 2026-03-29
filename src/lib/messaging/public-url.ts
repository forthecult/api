/**
 * Public HTTPS base URL for webhooks (Telegram setWebhook, copy-paste in dashboard).
 */
export function getPublicAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (explicit) {
    if (explicit.startsWith("http://") || explicit.startsWith("https://")) {
      return explicit.replace(/\/$/, "");
    }
    return `https://${explicit.replace(/\/$/, "")}`;
  }
  return "";
}
