/** Max length stored on `order.attribution_snapshot_json`. */
const MAX_SNAPSHOT = 4000;

export function attributionJsonFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): null | string {
  const raw = metadata?.attribution;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  return t.length > MAX_SNAPSHOT ? t.slice(0, MAX_SNAPSHOT) : t;
}
