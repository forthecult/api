import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/admin-api-auth";
import { createProduct } from "@/lib/pod/product-creator";

/**
 * POST /api/admin/pod/products
 *
 * Create a single POD product (Printify or Printful).
 * Body: CreateProductInput (JSON). For image.buffer use base64 string; decoded on server.
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = body as {
    blueprintId?: string;
    description?: string;
    image?: {
      buffer?: string;
      id?: string;
      url?: string;
    };
    printAreas?: {
      customPosition?: { scale: number; x: number; y: number };
      position: string;
      strategy: string;
    }[];
    printProviderId?: number;
    provider?: string;
    publish?: boolean;
    syncToStore?: boolean;
    tags?: string[];
    title?: string;
    variants?: { enabled: boolean; id: number; priceCents: number }[];
  };
  if (
    !input?.provider ||
    !input?.blueprintId ||
    !input?.title ||
    !input?.description ||
    !Array.isArray(input.printAreas) ||
    input.printAreas.length === 0 ||
    !Array.isArray(input.variants)
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: provider, blueprintId, title, description, printAreas, variants",
      },
      { status: 400 },
    );
  }
  if (!input.image?.id && !input.image?.url && !input.image?.buffer) {
    return NextResponse.json(
      { error: "image must have id, url, or buffer (base64)" },
      { status: 400 },
    );
  }
  const image = input.image as { buffer?: string; id?: string; url?: string };
  const decodedBuffer =
    typeof image.buffer === "string"
      ? Buffer.from(image.buffer, "base64")
      : undefined;
  try {
    const result = await createProduct({
      blueprintId: input.blueprintId,
      description: input.description,
      image: {
        buffer: decodedBuffer,
        id: image.id,
        url: image.url,
      },
      printAreas: input.printAreas.map((pa) => ({
        customPosition: pa.customPosition,
        position: pa.position,
        strategy: pa.strategy as
          | "center"
          | "center-top"
          | "custom"
          | "fill"
          | "fit"
          | "left-chest"
          | "pocket",
      })),
      printProviderId: input.printProviderId,
      provider: input.provider as "printful" | "printify",
      publish: input.publish ?? false,
      syncToStore: input.syncToStore ?? true,
      tags: input.tags,
      title: input.title,
      variants: input.variants,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
