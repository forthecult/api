/**
 * GET /api/admin/printify/catalog
 *
 * Proxy for Printify Catalog API. Allows browsing blueprints, print providers,
 * and variants through the admin API with proper authentication.
 *
 * Query params:
 * - (none)                          → list all blueprints
 * - blueprint=<id>                  → get specific blueprint details
 * - blueprint=<id>&providers=1      → list print providers for a blueprint
 * - blueprint=<id>&provider=<id>    → list variants for blueprint + provider
 * - blueprint=<id>&provider=<id>&shipping=1 → shipping info
 * - uploads=1                       → list uploaded images
 * - uploads=1&page=<n>             → paginated uploads
 */

import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchPrintifyBlueprint,
  fetchPrintifyBlueprints,
  fetchPrintifyPrintProviders,
  fetchPrintifyShippingInfo,
  fetchPrintifyVariants,
  getPrintifyIfConfigured,
  listPrintifyUploads,
} from "~/lib/printify";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const blueprintId = searchParams.get("blueprint");
  const providerId = searchParams.get("provider");
  const wantProviders = searchParams.get("providers") === "1";
  const wantShipping = searchParams.get("shipping") === "1";
  const wantUploads = searchParams.get("uploads") === "1";

  try {
    // List uploaded images
    if (wantUploads) {
      const page = Number(searchParams.get("page") || "1");
      const limit = Number(searchParams.get("limit") || "50");
      const uploads = await listPrintifyUploads({ limit, page });
      return NextResponse.json(uploads);
    }

    // No blueprint specified → list all blueprints
    if (!blueprintId) {
      const blueprints = await fetchPrintifyBlueprints();
      return NextResponse.json({
        blueprints,
        count: blueprints.length,
      });
    }

    const bpId = Number(blueprintId);

    // Blueprint + provider + shipping
    if (providerId && wantShipping) {
      const shipping = await fetchPrintifyShippingInfo(
        bpId,
        Number(providerId),
      );
      return NextResponse.json(shipping);
    }

    // Blueprint + provider → variants
    if (providerId) {
      const variants = await fetchPrintifyVariants(bpId, Number(providerId));
      return NextResponse.json(variants);
    }

    // Blueprint + providers flag → list providers
    if (wantProviders) {
      const providers = await fetchPrintifyPrintProviders(bpId);
      return NextResponse.json({ blueprint_id: bpId, providers });
    }

    // Blueprint only → get blueprint details
    const blueprint = await fetchPrintifyBlueprint(bpId);
    return NextResponse.json(blueprint);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
