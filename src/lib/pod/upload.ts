/**
 * Upload images to Printify and Printful.
 * - Printify: POST /v1/uploads/images.json (base64 body).
 * - Printful: POST /files with a public image URL (File Library API).
 */

import { getPrintifyToken } from "~/lib/printify";
import type { PodProvider, UploadResult } from "./types";

const PRINTIFY_V1_BASE = "https://api.printify.com/v1";
const PRINTFUL_V1_BASE = "https://api.printful.com";

type PrintifyFetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function printifyFetch<T>(
  endpoint: string,
  options: PrintifyFetchOptions,
): Promise<T> {
  const token = getPrintifyToken();
  const { body: bodyOption, ...rest } = options;
  const bodyInit: BodyInit | null | undefined =
    bodyOption != null ? JSON.stringify(bodyOption) : undefined;
  const res = await fetch(`${PRINTIFY_V1_BASE}${endpoint}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "CultureStore/1.0",
      ...rest.headers,
    },
    body: bodyInit,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printify upload failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

/**
 * Upload image buffer to Printify. Returns image id and preview URL for use in product creation.
 */
export async function uploadToPrintify(
  buffer: Buffer,
  filename: string,
): Promise<UploadResult> {
  const contents = buffer.toString("base64");
  const body = { file_name: filename, contents };
  const result = (await printifyFetch("/uploads/images.json", {
    method: "POST",
    body,
  })) as {
    id: string;
    file_name: string;
    height: number;
    width: number;
    size: number;
    mime_type: string;
    preview_url?: string;
  };
  return {
    provider: "printify",
    imageId: result.id,
    imageUrl:
      result.preview_url ?? `https://api.printify.com/uploads/${result.id}`,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}

/**
 * Register an image URL with Printful File Library. The URL must be publicly accessible.
 * Returns file id for use in sync variant files.
 */
export async function uploadToPrintful(
  imageUrl: string,
  options?: { type?: string; storeId?: number },
): Promise<UploadResult> {
  const type = options?.type ?? "default";
  const token = process.env.PRINTFUL_API_TOKEN?.trim();
  if (!token) throw new Error("PRINTFUL_API_TOKEN is not set");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (options?.storeId != null)
    headers["X-PF-Store-Id"] = String(options.storeId);
  const res = await fetch(`${PRINTFUL_V1_BASE}/files`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type, url: imageUrl }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful file upload failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as {
    code: number;
    result?: {
      id: number;
      url?: string;
      width?: number;
      height?: number;
    };
  };
  const result = json.result;
  if (!result) throw new Error("Printful file upload returned no result");
  return {
    provider: "printful",
    imageId: String(result.id),
    imageUrl: result.url ?? imageUrl,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}

/**
 * Upload via backend to the given provider.
 * - Printify: uploads buffer directly.
 * - Printful: requires a public URL; pass imageUrl in options or upload image elsewhere first and pass url.
 */
export async function uploadViaBackend(
  buffer: Buffer,
  provider: PodProvider,
  options?: { filename?: string; imageUrl?: string },
): Promise<UploadResult> {
  if (provider === "printify") {
    const filename = options?.filename ?? "design.png";
    return uploadToPrintify(buffer, filename);
  }
  if (provider === "printful") {
    const url = options?.imageUrl;
    if (!url) {
      throw new Error(
        "Printful requires a public image URL. Upload the image to your storage (e.g. UploadThing) and pass imageUrl.",
      );
    }
    return uploadToPrintful(url);
  }
  throw new Error(`Unknown provider: ${provider}`);
}
