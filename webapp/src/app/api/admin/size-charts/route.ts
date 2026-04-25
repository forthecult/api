import type { NextRequest } from "next/server";

import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { sizeChartsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { apiError } from "~/lib/api-error";

const PROVIDERS = ["printful", "printify", "manual"] as const;

/**
 * GET /api/admin/size-charts
 * List all size charts (admin). Optional: provider, brand, model filters.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider")?.trim();
    const brand = searchParams.get("brand")?.trim();
    const model = searchParams.get("model")?.trim();

    const conditions = [];
    if (provider) conditions.push(eq(sizeChartsTable.provider, provider));
    if (brand) conditions.push(eq(sizeChartsTable.brand, brand));
    if (model) conditions.push(eq(sizeChartsTable.model, model));

    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(sizeChartsTable)
            .where(and(...conditions))
            .orderBy(desc(sizeChartsTable.updatedAt))
        : await db
            .select()
            .from(sizeChartsTable)
            .orderBy(desc(sizeChartsTable.updatedAt));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("Admin size charts list error:", err);
    return apiError("INTERNAL_ERROR");
  }
}

/**
 * POST /api/admin/size-charts
 * Create a size chart. Body: { provider, brand, model, displayName, dataImperial?, dataMetric? }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      brand?: string;
      dataImperial?: unknown;
      dataMetric?: unknown;
      displayName?: string;
      model?: string;
      provider?: string;
    };

    const provider = body.provider?.trim();
    const brand = body.brand?.trim();
    const model = body.model?.trim();
    const displayName = body.displayName?.trim();

    if (
      !provider ||
      !PROVIDERS.includes(provider as (typeof PROVIDERS)[number])
    ) {
      return apiError("INVALID_REQUEST", {
        field: "provider",
        message: "Invalid or missing provider",
      });
    }
    if (!brand)
      return apiError("INVALID_REQUEST", {
        field: "brand",
        message: "Brand is required",
      });
    if (!model)
      return apiError("INVALID_REQUEST", {
        field: "model",
        message: "Model is required",
      });
    if (!displayName)
      return apiError("INVALID_REQUEST", {
        field: "displayName",
        message: "Display name is required",
      });

    const id = nanoid();
    const now = new Date();

    await db.insert(sizeChartsTable).values({
      brand,
      createdAt: now,
      dataImperial:
        body.dataImperial != null ? JSON.stringify(body.dataImperial) : null,
      dataMetric:
        body.dataMetric != null ? JSON.stringify(body.dataMetric) : null,
      displayName,
      id,
      model,
      provider,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(sizeChartsTable)
      .where(eq(sizeChartsTable.id, id))
      .limit(1);
    return NextResponse.json(
      created ?? { brand, displayName: body.displayName, id, model, provider },
    );
  } catch (err) {
    console.error("Admin size chart create error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
