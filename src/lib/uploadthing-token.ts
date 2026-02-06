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
