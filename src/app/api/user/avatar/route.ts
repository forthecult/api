import { type NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

import { auth } from "~/lib/auth";
import { getUploadThingToken } from "~/lib/uploadthing-token";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * POST /api/user/avatar
 * Upload avatar image for current user. Accepts multipart/form-data with field "file".
 * Returns { url: string }. Call PATCH /api/user/profile with { image: url } to set it.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData() as unknown as FormData;
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
  const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
  const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
  const isWebp =
    magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46 &&
    magicBytes[8] === 0x57 && magicBytes[9] === 0x45 && magicBytes[10] === 0x42 && magicBytes[11] === 0x50;
  const isGif = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;
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
      { error: "Upload not configured (UPLOADTHING_TOKEN missing)." },
      { status: 503 },
    );
  }

  try {
    const utapi = new UTApi({ token });
    const result = await utapi.uploadFiles(validatedFile);

    const data = Array.isArray(result) ? result[0] : result;
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Use only ufsUrl (file.url / file.appUrl are deprecated in uploadthing v9)
    const url =
      "ufsUrl" in data && typeof (data as { ufsUrl?: string }).ufsUrl === "string"
        ? (data as { ufsUrl: string }).ufsUrl
        : null;

    if (!url) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
