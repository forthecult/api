import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { UTApi } from "uploadthing/server";

import { getAdminAuth } from "~/lib/admin-api-auth";
import { getUploadThingToken } from "~/lib/uploadthing-token";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const WEBP_QUALITY = 85;
const MAX_WIDTH = 1600;

/** Optimize image for web: resize if large, compress to WebP. Preserve GIF as-is for animation. */
async function optimizeImageForWeb(file: File): Promise<File> {
  if (file.type === "image/gif") {
    return file;
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(buffer)
    .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const name = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([new Uint8Array(optimized)], `${name}.webp`, {
    type: "image/webp",
  });
}

/**
 * POST /api/admin/upload
 *
 * Upload an image to UploadThing. For use by admin (product images, brand assets, etc.).
 * Accepts multipart/form-data with field "file".
 * Returns { url: string }. Requires admin auth (session or ADMIN_API_KEY).
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing or invalid file. Use form field 'file'." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max 4MB." },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid type. Use JPEG, PNG, WebP, or GIF." },
      { status: 400 },
    );
  }

  const token = getUploadThingToken();
  if (!token) {
    return NextResponse.json(
      { error: "UPLOADTHING_TOKEN not set. Add it in .env (no quotes around the value)." },
      { status: 503 },
    );
  }

  try {
    let fileToUpload: File;
    try {
      fileToUpload = await optimizeImageForWeb(file);
    } catch {
      fileToUpload = file;
    }
    const utapi = new UTApi({ token });
    const result = await utapi.uploadFiles(fileToUpload);

    const data = Array.isArray(result) ? result[0] : result;
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 },
      );
    }

    const url =
      "ufsUrl" in data &&
      typeof (data as { ufsUrl?: string }).ufsUrl === "string"
        ? (data as { ufsUrl: string }).ufsUrl
        : "url" in data && typeof (data as { url?: string }).url === "string"
          ? (data as { url: string }).url
          : null;

    if (!url) {
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Admin upload error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}
