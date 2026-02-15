/**
 * Product mockup upload: fetch from Printful/Printify CDN, optimize to WebP,
 * apply SEO filename and alt text, upload to UploadThing.
 * Used by scripts/upload-product-mockups.ts.
 */

import sharp from "sharp";
import type { UTApi } from "uploadthing/server";

import { slugify } from "~/lib/slugify";

const WEBP_QUALITY = 85;
const MAX_WIDTH = 1600;

/** Whether the URL is from a Printful or Printify CDN (should be re-hosted). */
export function isProviderImageUrl(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("printful") || host.includes("printify");
  } catch {
    return false;
  }
}

/** Whether the URL is already from UploadThing (no need to re-upload). */
export function isUploadThingUrl(url: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes("utfs.io") ||
      host.includes("ufs.sh") ||
      host.includes("uploadthing")
    );
  } catch {
    return false;
  }
}

const SEEED_CACHE_BASE =
  "https://media-cdn.seeedstudio.com/media/catalog/product/cache/1/image/1200x1200/9df78eab33525d08d6e5fb8d27136e95";

/** Seeed cache URL → direct catalog URL (often returns real image when cache returns placeholder). */
export function getSeeedDirectUrl(cacheUrl: string): string | null {
  if (!cacheUrl.includes("seeedstudio.com")) return null;
  if (!cacheUrl.includes("/cache/")) return null;
  try {
    const u = new URL(cacheUrl);
    const path = u.pathname;
    const cacheSegment = /\/cache\/[^/]+\/[^/]+\/[^/]+\/[^/]+\//;
    if (!cacheSegment.test(path)) return null;
    u.pathname = path.replace(cacheSegment, "/");
    return u.toString();
  } catch {
    return null;
  }
}

/** Seeed direct catalog URL → 1200x1200 cache URL (often returns full-size image when direct returns placeholder). */
export function getSeeedCacheUrl(directUrl: string): string | null {
  if (!directUrl.includes("seeedstudio.com")) return null;
  if (directUrl.includes("/cache/")) return null;
  try {
    const u = new URL(directUrl);
    const path = u.pathname;
    const prefix = "/media/catalog/product/";
    if (!path.startsWith(prefix)) return null;
    const rest = path.slice(prefix.length);
    if (!rest) return null;
    return `${SEEED_CACHE_BASE}/${rest}${u.search}`;
  } catch {
    return null;
  }
}

/** Optimize image buffer to WebP (smaller, fast). */
export async function optimizeImageToWebP(
  buffer: Buffer,
  _contentType?: string,
): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/** Build an SEO-friendly filename: product-name-mockup.webp or product-name-variant-mockup-2.webp */
export function buildSeoFilename(
  productName: string,
  opts?: { variantLabel?: string | null; index?: number },
): string {
  const base = slugify(productName).slice(0, 60) || "product";
  const variant = opts?.variantLabel
    ? `-${slugify(opts.variantLabel).slice(0, 30)}`
    : "";
  const suffix = opts?.index != null && opts.index > 0 ? `-${opts.index}` : "";
  return `${base}${variant}-mockup${suffix}.webp`;
}

/** Build SEO alt text for the mockup image. */
export function buildSeoAlt(
  productName: string,
  opts?: { variantLabel?: string | null; index?: number },
): string {
  const variant = opts?.variantLabel ? ` ${opts.variantLabel}` : "";
  const suffix =
    opts?.index != null && opts.index > 0 ? ` (view ${opts.index + 1})` : "";
  return `${productName}${variant} product mockup${suffix}`.trim();
}

export type UploadMockupParams = {
  sourceUrl: string;
  productName: string;
  alt?: string;
  variantLabel?: string | null;
  index?: number;
};

export type UploadMockupResult = {
  url: string;
  key: string;
  filename: string;
  alt: string;
};

/**
 * Fetch image from sourceUrl, optimize to WebP, assign SEO filename and alt,
 * upload to UploadThing. Returns the new URL and metadata or null on failure.
 */
export async function uploadMockupToUploadThing(
  utapi: UTApi,
  params: UploadMockupParams,
): Promise<UploadMockupResult | null> {
  const { sourceUrl, productName, variantLabel, index } = params;
  const filename = buildSeoFilename(productName, { variantLabel, index });
  const alt = params.alt ?? buildSeoAlt(productName, { variantLabel, index });

  const MIN_SOURCE_BYTES = 12_000;
  /** Seeed often serves a second placeholder (gray with icon) that is ≥12KB; require larger min to skip it. */
  const MIN_SOURCE_BYTES_SEEED = 35_000;
  const fetchOptions = {
    headers: {
      Accept: "image/*",
      "User-Agent": "Mozilla/5.0 (compatible; CultureStore/1.0; image-fetch)",
    },
    signal: AbortSignal.timeout(30_000) as AbortSignal,
  };

  async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, fetchOptions);
      if (!res.ok) return null;
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (contentType.startsWith("text/") || contentType.includes("html"))
        return null;
      const arr = await res.arrayBuffer();
      return Buffer.from(arr);
    } catch {
      return null;
    }
  }

  let buffer: Buffer | null = await fetchImageBuffer(sourceUrl);
  if (!buffer || buffer.length === 0) {
    console.warn(`Empty or failed fetch: ${sourceUrl}`);
    return null;
  }

  const isSeeed = sourceUrl.includes("seeedstudio.com");
  const minBytesForSource = isSeeed ? MIN_SOURCE_BYTES_SEEED : MIN_SOURCE_BYTES;

  // If Seeed returned a tiny or "second" placeholder (gray with icon, often 12–35KB), try alternate URL: cache→direct or direct→cache
  if (buffer.length < minBytesForSource && isSeeed) {
    const directUrl = getSeeedDirectUrl(sourceUrl);
    if (directUrl && directUrl !== sourceUrl) {
      const altBuffer = await fetchImageBuffer(directUrl);
      if (altBuffer && altBuffer.length >= minBytesForSource) {
        buffer = altBuffer;
      }
    }
    if (buffer.length < minBytesForSource) {
      const cacheUrl = getSeeedCacheUrl(sourceUrl);
      if (cacheUrl && cacheUrl !== sourceUrl) {
        const altBuffer = await fetchImageBuffer(cacheUrl);
        if (altBuffer && altBuffer.length >= minBytesForSource) {
          buffer = altBuffer;
        }
      }
    }
  }

  if (buffer.length < minBytesForSource) {
    console.warn(
      `Source image too small (${buffer.length} bytes, min ${minBytesForSource} for ${isSeeed ? "Seeed" : "source"}) for ${sourceUrl}; skipping to avoid blank/placeholder. Use a real product image URL in seed data.`,
    );
    return null;
  }

  let metadata: { width?: number; height?: number };
  try {
    metadata = (await sharp(buffer).metadata()) as {
      width?: number;
      height?: number;
    };
  } catch (err) {
    console.warn(`Invalid image data for ${sourceUrl}:`, err);
    return null;
  }
  const w = metadata?.width ?? 0;
  const h = metadata?.height ?? 0;
  const minDimension = 32;
  if (w < minDimension || h < minDimension) {
    console.warn(
      `Image too small or invalid (${w}x${h}) for ${sourceUrl}; skipping to avoid blank/placeholder.`,
    );
    return null;
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await optimizeImageToWebP(buffer);
  } catch (err) {
    console.warn(`Optimize error for ${sourceUrl}:`, err);
    return null;
  }

  const file = new File([new Uint8Array(webpBuffer)], filename, {
    type: "image/webp",
  });

  try {
    const result = await utapi.uploadFiles(file);
    const data = Array.isArray(result) ? result[0] : result;
    const res = data as {
      url?: string;
      ufsUrl?: string;
      key?: string;
      data?: { url?: string; ufsUrl?: string; key?: string };
      error?: { code?: string; message?: string };
    };
    if (res?.error) {
      console.warn(`UploadThing error for ${filename}:`, res.error);
      return null;
    }
    // Use only ufsUrl (file.url / file.appUrl deprecated in uploadthing v9)
    const url = res?.ufsUrl ?? res?.data?.ufsUrl ?? null;
    const key = res?.key ?? res?.data?.key ?? null;
    if (!url) {
      console.warn(`No URL in UploadThing response for ${filename}`);
      return null;
    }
    return {
      url,
      key: key ?? "",
      filename,
      alt,
    };
  } catch (err) {
    console.warn(`Upload error for ${filename}:`, err);
    return null;
  }
}
