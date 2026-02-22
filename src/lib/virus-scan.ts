/**
 * Optional virus scan for uploaded files via VirusTotal API v3.
 * Set VIRUSTOTAL_API_KEY in env to enable; if unset, scan is skipped (caller may treat as pass).
 */

const VT_API = "https://www.virustotal.com/api/v3";
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB cap for avatar fetch
const POLL_MS = 3000;
const POLL_ATTEMPTS = 20;

export type VirusScanResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Scan a file at the given URL using VirusTotal. Returns { ok: true } if clean or scan skipped;
 * { ok: false, error } if malicious or scan failed.
 * Skips scan when VIRUSTOTAL_API_KEY is not set (returns ok: true).
 */
export async function scanFileUrl(url: string): Promise<VirusScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) {
    return { ok: true };
  }

  let buffer: ArrayBuffer;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/octet-stream" },
    });
    if (!res.ok) {
      return { ok: false, error: `fetch failed: ${res.status}` };
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_BYTES) {
      return { ok: false, error: "file too large to scan" };
    }
    buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return { ok: false, error: "file too large to scan" };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "failed to fetch file",
    };
  }

  const form = new FormData();
  form.append("file", new Blob([buffer]), "avatar");

  let analysisId: string;
  try {
    const uploadRes = await fetch(`${VT_API}/files`, {
      method: "POST",
      headers: { "x-apikey": apiKey },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return {
        ok: false,
        error: `VirusTotal upload failed: ${uploadRes.status} ${errBody.slice(0, 200)}`,
      };
    }
    const uploadJson = (await uploadRes.json()) as {
      data?: { id?: string };
    };
    analysisId = uploadJson.data?.id ?? "";
    if (!analysisId) {
      return { ok: false, error: "VirusTotal returned no analysis id" };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "VirusTotal request failed",
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
        return { ok: false, error: `VirusTotal report failed: ${reportRes.status}` };
      }
      const report = (await reportRes.json()) as {
        data?: {
          attributes?: {
            status?: string;
            stats?: { malicious?: number; suspicious?: number };
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
        return { ok: false, error: "file flagged as malicious" };
      }
      return { ok: true };
    } catch {
      // poll again
    }
  }

  return { ok: false, error: "virus scan timed out" };
}
