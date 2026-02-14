import { type NextRequest, NextResponse } from "next/server";
import { bulkCreate } from "@/lib/pod/bulk-creator";
import { getAdminAuth } from "@/lib/admin-api-auth";

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
    image?: string;
    title?: string;
    description?: string;
    targets?: Array<{
      provider: string;
      blueprintId: string;
      printProviderId?: number;
      positions: string[];
      placementStrategy: string;
      variantFilter?: { colors?: string[]; sizes?: string[] };
      pricing: { type: string; value: number };
    }>;
    syncToStore?: boolean;
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
      image: input.image,
      title: input.title,
      description: input.description,
      targets: input.targets.map((t) => ({
        provider: t.provider as "printify" | "printful",
        blueprintId: t.blueprintId,
        printProviderId: t.printProviderId,
        positions: t.positions,
        placementStrategy: t.placementStrategy as
          | "center"
          | "center-top"
          | "fill"
          | "fit"
          | "left-chest"
          | "pocket"
          | "custom",
        variantFilter: t.variantFilter,
        pricing: {
          type: t.pricing.type as "markup_percent" | "markup_fixed" | "fixed",
          value: t.pricing.value,
        },
      })),
      syncToStore: input.syncToStore ?? true,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
