/**
 * Normalize UPLOADTHING_TOKEN from env.
 * Many env UIs or .env files store values with quotes (e.g. UPLOADTHING_TOKEN='eyJ...').
 * UploadThing expects the raw token; leading/trailing quotes cause auth to fail.
 */
export function getUploadThingToken(): string | undefined {
  const raw = process.env.UPLOADTHING_TOKEN;
  if (raw == null || raw === "") return undefined;
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

/**
 * UploadThing expects token to be base64-encoded JSON: { apiKey: string, appId: string, regions: string[] }.
 * Use this in scripts to fail fast with a clear message before making upload requests.
 */
export function validateUploadThingToken(token: string): boolean {
  try {
    if (typeof Buffer === "undefined") return true; // browser: skip validation
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const obj = JSON.parse(decoded) as unknown;
    if (obj == null || typeof obj !== "object") return false;
    const o = obj as Record<string, unknown>;
    return (
      typeof o.apiKey === "string" &&
      typeof o.appId === "string" &&
      Array.isArray(o.regions) &&
      o.regions.every((r: unknown) => typeof r === "string")
    );
  } catch {
    return false;
  }
}
