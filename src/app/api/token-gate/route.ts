import type { NextRequest } from "next/server";

import { apiError, apiSuccess } from "~/lib/api-error";
import { getTokenGateConfig } from "~/lib/token-gate";

const RESOURCE_TYPES = ["product", "category", "page"] as const;

/**
 * GET /api/token-gate?resourceType=product|category|page&resourceId=xxx
 * Returns token gate config for the resource (tokenGated, gates).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const resourceType = searchParams.get("resourceType")?.toLowerCase();
    const resourceId = searchParams.get("resourceId")?.trim();

    if (
      !resourceType ||
      !RESOURCE_TYPES.includes(resourceType as (typeof RESOURCE_TYPES)[0])
    ) {
      return apiError("MISSING_REQUIRED_FIELD", {
        expected: RESOURCE_TYPES.join(" | "),
        field: "resourceType",
      });
    }
    if (!resourceId) {
      return apiError("MISSING_REQUIRED_FIELD", { field: "resourceId" });
    }

    const config = await getTokenGateConfig(
      resourceType as "category" | "page" | "product",
      resourceId,
    );

    return apiSuccess({
      gates: config.gates.map((g) => ({
        gateType: g.gateType,
        network: g.network,
        quantity: g.quantity,
        tokenSymbol: g.tokenSymbol,
      })),
      tokenGated: config.tokenGated,
    });
  } catch (err) {
    console.error("Token gate config error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
