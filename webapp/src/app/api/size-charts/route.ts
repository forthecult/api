import type { NextRequest } from "next/server";

import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import { sizeChartsTable } from "~/db/schema";
import { apiError, apiSuccess } from "~/lib/api-error";

/**
 * GET /api/size-charts?provider=printful&brand=Bella+%2B+Canvas&model=3001
 * Returns the size chart for the given provider + brand + model (public, for product page).
 * 404 if not found.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider")?.trim();
    const brand = searchParams.get("brand")?.trim();
    const model = searchParams.get("model")?.trim();

    if (!provider || !brand || !model) {
      return apiError("MISSING_REQUIRED_FIELD", {
        fields: ["provider", "brand", "model"],
      });
    }

    const [chart] = await db
      .select()
      .from(sizeChartsTable)
      .where(
        and(
          eq(sizeChartsTable.provider, provider),
          eq(sizeChartsTable.brand, brand),
          eq(sizeChartsTable.model, model),
        ),
      )
      .limit(1);

    if (!chart) {
      return apiError("NOT_FOUND", { message: "Size chart not found" });
    }

    return apiSuccess({
      brand: chart.brand,
      dataImperial: chart.dataImperial as unknown,
      dataMetric: chart.dataMetric as unknown,
      displayName: chart.displayName,
      id: chart.id,
      model: chart.model,
      provider: chart.provider,
    });
  } catch (err) {
    console.error("Size chart fetch error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
