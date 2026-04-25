import { type NextRequest, NextResponse } from "next/server";

import type { PodProvider } from "@/lib/pod/types";

import { adminAuthFailureResponse, getAdminAuth } from "@/lib/admin-api-auth";
import { fetchBlueprintWithSpecs } from "@/lib/pod/catalog";

/**
 * GET /api/admin/pod/catalog/[blueprintId]
 *
 * Get a single blueprint with full print specs and variants.
 * Query: provider=printify|printful, printProviderId= (required for Printify)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blueprintId: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);
  const { blueprintId } = await params;
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") as null | PodProvider;
  const printProviderIdParam = searchParams.get("printProviderId");
  if (!provider || (provider !== "printify" && provider !== "printful")) {
    return NextResponse.json(
      { error: "Query provider is required: printify or printful" },
      { status: 400 },
    );
  }
  if (provider === "printify" && !printProviderIdParam) {
    return NextResponse.json(
      { error: "printProviderId is required for Printify blueprints" },
      { status: 400 },
    );
  }
  const printProviderId =
    printProviderIdParam != null
      ? Number.parseInt(printProviderIdParam, 10)
      : undefined;
  if (
    provider === "printify" &&
    (Number.isNaN(printProviderId!) || printProviderId! < 1)
  ) {
    return NextResponse.json(
      { error: "Invalid printProviderId" },
      { status: 400 },
    );
  }
  try {
    const blueprint = await fetchBlueprintWithSpecs(
      provider,
      blueprintId,
      printProviderId,
    );
    return NextResponse.json(blueprint);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
