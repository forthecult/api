import { type NextRequest, NextResponse } from "next/server";
import { createProduct } from "@/lib/pod/product-creator";
import { getAdminAuth } from "@/lib/admin-api-auth";

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
    provider?: string;
    blueprintId?: string;
    printProviderId?: number;
    title?: string;
    description?: string;
    tags?: string[];
    image?: {
      id?: string;
      url?: string;
      buffer?: string;
    };
    printAreas?: Array<{
      position: string;
      strategy: string;
      customPosition?: { x: number; y: number; scale: number };
    }>;
    variants?: Array<{ id: number; enabled: boolean; priceCents: number }>;
    syncToStore?: boolean;
    publish?: boolean;
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
  const image = input.image as { id?: string; url?: string; buffer?: string };
  const decodedBuffer =
    typeof image.buffer === "string"
      ? Buffer.from(image.buffer, "base64")
      : undefined;
  try {
    const result = await createProduct({
      provider: input.provider as "printify" | "printful",
      blueprintId: input.blueprintId,
      printProviderId: input.printProviderId,
      title: input.title,
      description: input.description,
      tags: input.tags,
      image: {
        id: image.id,
        url: image.url,
        buffer: decodedBuffer,
      },
      printAreas: input.printAreas.map((pa) => ({
        position: pa.position,
        strategy: pa.strategy as
          | "center"
          | "center-top"
          | "fill"
          | "fit"
          | "left-chest"
          | "pocket"
          | "custom",
        customPosition: pa.customPosition,
      })),
      variants: input.variants,
      syncToStore: input.syncToStore ?? true,
      publish: input.publish ?? false,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
