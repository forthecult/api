import { US_STATE_OPTIONS } from "~/app/checkout/checkout-shared";

const US_STATE_VALUES = new Set(
  US_STATE_OPTIONS.map((o) => o.value).filter((v) => v.length > 0),
);

const US_STATE_LABEL_TO_VALUE = new Map<string, string>();
for (const o of US_STATE_OPTIONS) {
  if (!o.value) continue;
  US_STATE_LABEL_TO_VALUE.set(
    o.label.toUpperCase().replace(/\s+/g, " ").trim(),
    o.value,
  );
}

/**
 * Map a US subdivision from geo APIs (2-letter code and/or full name) to our
 * checkout state value (ISO 3166-2 state code).
 */
export function resolveUsStateCodeFromGeo(
  region: null | string | undefined,
  regionName?: null | string | undefined,
): null | string {
  const tryLabel = (raw: null | string | undefined): null | string => {
    if (!raw?.trim()) return null;
    const key = raw.trim().toUpperCase().replace(/\s+/g, " ");
    if (key.length === 2 && US_STATE_VALUES.has(key)) return key;
    return US_STATE_LABEL_TO_VALUE.get(key) ?? null;
  };

  const fromName = tryLabel(regionName);
  if (fromName) return fromName;

  const fromRegion = tryLabel(region);
  if (fromRegion) return fromRegion;

  if (!region?.trim()) return null;
  const compact = region
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (compact.length === 2 && US_STATE_VALUES.has(compact)) return compact;
  return null;
}
