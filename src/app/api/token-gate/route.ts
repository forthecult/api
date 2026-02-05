import type { NextRequest } from "next/server";

import { getTokenGateConfig } from "~/lib/token-gate";
import { apiError, apiSuccess } from "~/lib/api-error";

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
        field: "resourceType",
        expected: RESOURCE_TYPES.join(" | "),
      });
    }
    if (!resourceId) {
      return apiError("MISSING_REQUIRED_FIELD", { field: "resourceId" });
    }

    const config = await getTokenGateConfig(
      resourceType as "product" | "category" | "page",
      resourceId,
    );

    return apiSuccess({
      tokenGated: config.tokenGated,
      gates: config.gates.map((g) => ({
        tokenSymbol: g.tokenSymbol,
        quantity: g.quantity,
        network: g.network,
        gateType: g.gateType,
      })),
    });
  } catch (err) {
    console.error("Token gate config error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
