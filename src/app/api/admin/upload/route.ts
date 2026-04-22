import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { UTApi } from "uploadthing/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { getUploadThingToken } from "~/lib/uploadthing-token";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const WEBP_QUALITY = 85;
const MAX_WIDTH = 1600;

/**
 * POST /api/admin/upload
 *
 * Upload an image to UploadThing. For use by admin (product images, brand assets, etc.).
 * Accepts multipart/form-data with field "file".
 * Returns { url: string }. Requires admin auth (session or ADMIN_API_KEY).
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let formData: FormData;
  try {
    formData = (await request.formData()) as unknown as FormData;
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
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

  // Verify actual content matches claimed type via magic bytes
  const fileBytes = await file.arrayBuffer();
  const magicBytes = Buffer.from(fileBytes).subarray(0, 12);
  const isJpeg = magicBytes[0] === 0xff && magicBytes[1] === 0xd8;
  const isPng =
    magicBytes[0] === 0x89 &&
    magicBytes[1] === 0x50 &&
    magicBytes[2] === 0x4e &&
    magicBytes[3] === 0x47;
  const isWebp =
    magicBytes[0] === 0x52 &&
    magicBytes[1] === 0x49 &&
    magicBytes[2] === 0x46 &&
    magicBytes[3] === 0x46 &&
    magicBytes[8] === 0x57 &&
    magicBytes[9] === 0x45 &&
    magicBytes[10] === 0x42 &&
    magicBytes[11] === 0x50;
  const isGif =
    magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
  if (!isJpeg && !isPng && !isWebp && !isGif) {
    return NextResponse.json(
      { error: "File content does not match an allowed image type" },
      { status: 400 },
    );
  }

  // Reconstruct file from already-read bytes so downstream consumers can use it
  const validatedFile = new File([fileBytes], file.name, { type: file.type });

  const token = getUploadThingToken();
  if (!token) {
    return NextResponse.json(
      {
        error:
          "UPLOADTHING_TOKEN not set. Add it in .env (no quotes around the value).",
      },
      { status: 503 },
    );
  }

  try {
    let fileToUpload: File;
    try {
      fileToUpload = await optimizeImageForWeb(validatedFile);
    } catch (err) {
      console.warn("Admin upload: optimize failed, using original file", err);
      fileToUpload = validatedFile;
    }
    const utapi = new UTApi({ token });
    const result = await utapi.uploadFiles(fileToUpload);

    // UTApi returns { data: { ufsUrl, key, ... }, error: null } on success, or { data: null, error } on failure.
    // Some runtimes may return the file object at top level; accept both shapes.
    const payload = Array.isArray(result) ? result[0] : result;
    const err =
      payload &&
      typeof payload === "object" &&
      (payload as { error?: unknown }).error;
    if (err) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Upload failed";
      console.error("Admin upload: UploadThing error", err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const data =
      payload &&
      typeof payload === "object" &&
      (payload as { data?: unknown }).data != null
        ? (payload as { data: Record<string, unknown> }).data
        : (payload as null | Record<string, unknown>);

    // Resolve URL: prefer nested data.ufsUrl/data.url, then top-level payload.ufsUrl/payload.url
    const fromData =
      data && typeof data === "object"
        ? ((typeof (data as { ufsUrl?: string }).ufsUrl === "string"
            ? (data as { ufsUrl: string }).ufsUrl
            : null) ??
          (typeof (data as { url?: string }).url === "string"
            ? (data as { url: string }).url
            : null))
        : null;
    const fromPayload =
      payload && typeof payload === "object"
        ? ((typeof (payload as { ufsUrl?: string }).ufsUrl === "string"
            ? (payload as { ufsUrl: string }).ufsUrl
            : null) ??
          (typeof (payload as { url?: string }).url === "string"
            ? (payload as { url: string }).url
            : null))
        : null;
    const url = fromData ?? fromPayload;

    if (!url) {
      console.error("Admin upload: no url in result", {
        data,
        payload:
          payload && typeof payload === "object" ? { ...payload } : payload,
      });
      return NextResponse.json(
        {
          error:
            "Upload failed: no URL in UploadThing response. Ensure latest upload route is deployed and UPLOADTHING_TOKEN is valid.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Admin upload error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Upload failed",
      },
      { status: 500 },
    );
  }
}

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
