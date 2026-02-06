import { type NextRequest, NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

import { getAdminAuth } from "~/lib/admin-api-auth";

const MAX_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

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

  try {
    const utapi = new UTApi();
    const result = await utapi.uploadFiles(file);

    const data = Array.isArray(result) ? result[0] : result;
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 },
      );
    }

    const url =
      "url" in data && typeof (data as { url?: string }).url === "string"
        ? (data as { url: string }).url
        : "ufsUrl" in data &&
            typeof (data as { ufsUrl?: string }).ufsUrl === "string"
          ? (data as { ufsUrl: string }).ufsUrl
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
