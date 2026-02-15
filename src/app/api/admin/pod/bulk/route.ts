import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/admin-api-auth";
import { bulkCreate } from "@/lib/pod/bulk-creator";

/**
 * POST /api/admin/pod/bulk
 *
 * Create multiple POD products from one image across many blueprints.
 * Body: BulkCreateInput (JSON). image: base64 string or URL string.
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
    description?: string;
    image?: string;
    syncToStore?: boolean;
    targets?: {
      blueprintId: string;
      placementStrategy: string;
      positions: string[];
      pricing: { type: string; value: number };
      printProviderId?: number;
      provider: string;
      variantFilter?: { colors?: string[]; sizes?: string[] };
    }[];
    title?: string;
  };
  if (
    !input?.image ||
    !input?.title ||
    !input?.description ||
    !Array.isArray(input.targets) ||
    input.targets.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: image (base64 or URL), title, description, targets",
      },
      { status: 400 },
    );
  }
  try {
    const result = await bulkCreate({
      description: input.description,
      image: input.image,
      syncToStore: input.syncToStore ?? true,
      targets: input.targets.map((t) => ({
        blueprintId: t.blueprintId,
        placementStrategy: t.placementStrategy as
          | "center"
          | "center-top"
          | "custom"
          | "fill"
          | "fit"
          | "left-chest"
          | "pocket",
        positions: t.positions,
        pricing: {
          type: t.pricing.type as "fixed" | "markup_fixed" | "markup_percent",
          value: t.pricing.value,
        },
        printProviderId: t.printProviderId,
        provider: t.provider as "printful" | "printify",
        variantFilter: t.variantFilter,
      })),
      title: input.title,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
