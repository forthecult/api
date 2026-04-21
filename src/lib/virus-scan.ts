/**
 * Optional virus scan for uploaded files via VirusTotal API v3.
 * Set VIRUSTOTAL_API_KEY in env to enable; if unset, scan is skipped (caller may treat as pass).
 */

const VT_API = "https://www.virustotal.com/api/v3";
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB cap for avatar fetch
const POLL_MS = 3000;
const POLL_ATTEMPTS = 20;

export type VirusScanResult = { error: string; ok: false } | { ok: true };

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
      headers: { Accept: "application/octet-stream" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { error: `fetch failed: ${res.status}`, ok: false };
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_BYTES) {
      return { error: "file too large to scan", ok: false };
    }
    buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_FILE_BYTES) {
      return { error: "file too large to scan", ok: false };
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
