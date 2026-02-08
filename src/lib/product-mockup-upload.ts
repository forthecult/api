/**
 * Product mockup upload: fetch from Printful/Printify CDN, optimize to WebP,
 * apply SEO filename and alt text, upload to UploadThing.
 * Used by scripts/upload-product-mockups.ts.
 */

import sharp from "sharp";
import { UTApi } from "uploadthing/server";

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

  let buffer: Buffer;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; CultureStore/1.0; image-fetch)",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`Fetch failed ${res.status}: ${sourceUrl}`);
      return null;
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.startsWith("text/") || contentType.includes("html")) {
      console.warn(`Source returned non-image (${contentType}): ${sourceUrl}`);
      return null;
    }
    if (contentType.length > 0 && !contentType.startsWith("image/")) {
      console.warn(`Source may not be image (${contentType}): ${sourceUrl}`);
    }
    const arr = await res.arrayBuffer();
    buffer = Buffer.from(arr);
  } catch (err) {
    console.warn(`Fetch error for ${sourceUrl}:`, err);
    return null;
  }

  if (buffer.length === 0) {
    console.warn(`Empty image: ${sourceUrl}`);
    return null;
  }

  let metadata: { width?: number; height?: number };
  try {
    metadata = (await sharp(buffer).metadata()) as { width?: number; height?: number };
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

  const file = new File(
    [new Uint8Array(webpBuffer)],
    filename,
    { type: "image/webp" },
  );

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
