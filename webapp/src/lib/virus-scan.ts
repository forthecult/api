/**
 * Virus scan for uploaded files via VirusTotal API v3.
 * VIRUSTOTAL_API_KEY is REQUIRED in production unless ALLOW_UNSCANNED_UPLOADS=1.
 * in dev, missing key skips scanning.
 */

const VT_API = "https://www.virustotal.com/api/v3";
const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB – matches the image uploader cap
const POLL_MS = 3000;
const POLL_ATTEMPTS = 20;
const ALLOW_UNSCANNED_UPLOADS = process.env.ALLOW_UNSCANNED_UPLOADS === "1";

export type VirusScanResult = { error: string; ok: false } | { ok: true };

interface ScanOptions {
  /** Files larger than this are passed-through without scanning (with a warning log) to avoid blowing scan latency / quota. Defaults to 4MB. */
  maxBytes?: number;
}

/**
 * m6: boot-time assert that VIRUSTOTAL_API_KEY is present in production. Call
 * this from module-level code that's loaded at startup (e.g. the upload router)
 * so a missing key fails loudly instead of silently disabling malware scans.
 */
export function assertVirusTotalConfigured(): void {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    !apiKey &&
    !ALLOW_UNSCANNED_UPLOADS
  ) {
    throw new Error(
      "VIRUSTOTAL_API_KEY is required in production — uploads must be virus-scanned.",
    );
  }
}

/**
 * Scan a file at the given URL using VirusTotal. Returns { ok: true } if clean or scan skipped;
 * { ok: false, error } if malicious or scan failed.
 * Skips scan when VIRUSTOTAL_API_KEY is not set unless production enforcement is active.
 */
export async function scanFileUrl(
  url: string,
  options: ScanOptions = {},
): Promise<VirusScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV === "production" && !ALLOW_UNSCANNED_UPLOADS) {
      return { error: "virus scan is not configured", ok: false };
    }
    return { ok: true };
  }
  const MAX_FILE_BYTES = options.maxBytes ?? DEFAULT_MAX_FILE_BYTES;

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/octet-stream" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { error: `fetch failed: ${res.status}`, ok: false };
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_BYTES) {
      // m6: oversized files skip scan rather than hard-reject — the provider
      // (uploadthing) already does basic type/size checks and we don't want to
      // block 64mb video uploads on free-tier vt quotas. log so we can spot
      // abuse.
      console.warn(
        `[virus-scan] skipping scan for oversized file (${contentLength} bytes > ${MAX_FILE_BYTES}): ${url}`,
      );
      return { ok: true };
    }
    buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      console.warn(
        `[virus-scan] skipping scan for oversized file (${buffer.byteLength} bytes > ${MAX_FILE_BYTES}): ${url}`,
      );
      return { ok: true };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "failed to fetch file",
      ok: false,
    };
  }

  const form = new FormData();
  form.append("file", new Blob([buffer]), "avatar");

  let analysisId: string;
  try {
    const uploadRes = await fetch(`${VT_API}/files`, {
      body: form,
      headers: { "x-apikey": apiKey },
      method: "POST",
      signal: AbortSignal.timeout(30000),
    });
    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return {
        error: `VirusTotal upload failed: ${uploadRes.status} ${errBody.slice(0, 200)}`,
        ok: false,
      };
    }
    const uploadJson = (await uploadRes.json()) as {
      data?: { id?: string };
    };
    analysisId = uploadJson.data?.id ?? "";
    if (!analysisId) {
      return { error: "VirusTotal returned no analysis id", ok: false };
    }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "VirusTotal request failed",
      ok: false,
    };
  }

  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const reportRes = await fetch(`${VT_API}/analyses/${analysisId}`, {
        headers: { "x-apikey": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!reportRes.ok) {
        return {
          error: `VirusTotal report failed: ${reportRes.status}`,
          ok: false,
        };
      }
      const report = (await reportRes.json()) as {
        data?: {
          attributes?: {
            stats?: { malicious?: number; suspicious?: number };
            status?: string;
          };
        };
      };
      const status = report.data?.attributes?.status;
      if (status !== "completed") {
        continue;
      }
      const stats = report.data?.attributes?.stats;
      const malicious = (stats?.malicious ?? 0) + (stats?.suspicious ?? 0);
      if (malicious > 0) {
        return { error: "file flagged as malicious", ok: false };
      }
      return { ok: true };
    } catch {
      // poll again
    }
  }

  return { error: "virus scan timed out", ok: false };
}
