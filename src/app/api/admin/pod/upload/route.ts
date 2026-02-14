import { type NextRequest, NextResponse } from "next/server";
import { uploadToPrintify, uploadToPrintful } from "@/lib/pod/upload";
import {
  analyzeImage,
  validateForPrint,
  makeBackgroundTransparent,
} from "@/lib/pod/image-processor";
import { getAdminAuth } from "@/lib/admin-api-auth";
import type { PodProvider } from "@/lib/pod/types";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/admin/pod/upload
 *
 * Upload an image for POD. FormData: file (image).
 * Query: provider=printify|printful, process=true (optional), makeTransparent=true (optional, dark bg -> transparent)
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const provider = request.nextUrl.searchParams.get("provider") as PodProvider | null;
  if (!provider || (provider !== "printify" && provider !== "printful")) {
    return NextResponse.json(
      { error: "Query provider is required: printify or printful" },
      { status: 400 },
    );
  }
  let formData: FormData;
  try {
    formData = await request.formData() as unknown as FormData;
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file in form data" },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 20MB)" },
      { status: 400 },
    );
  }
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  const process = request.nextUrl.searchParams.get("process") === "true";
  const makeTransparent = request.nextUrl.searchParams.get("makeTransparent") === "true";
  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  if (makeTransparent) {
    try {
      buffer = (await makeBackgroundTransparent(buffer, 30)) as Buffer;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "makeTransparent failed", detail: message },
        { status: 400 },
      );
    }
  }
  const filename = file.name || "design.png";
  const warnings: string[] = [];
  let analysis: Awaited<ReturnType<typeof analyzeImage>> | undefined;
  try {
    analysis = await analyzeImage(buffer);
    if (process) {
      const validation = await validateForPrint(buffer, {
        position: "front",
        width: 3600,
        height: 4800,
        dpi: 150,
      });
      warnings.push(...validation.warnings);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Image analysis failed", detail: message },
      { status: 400 },
    );
  }
  try {
    if (provider === "printify") {
      const result = await uploadToPrintify(buffer, filename);
      return NextResponse.json({
        imageId: result.imageId,
        imageUrl: result.imageUrl,
        width: result.width,
        height: result.height,
        analysis,
        warnings,
      });
    }
    return NextResponse.json(
      {
        error:
          "Printful requires a public image URL. Use uploadToPrintful(url) or upload the file to your storage first and pass the URL when creating the product.",
      },
      { status: 400 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
