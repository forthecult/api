/**
 * GET /api/admin/products/crustafarian-printify
 *
 * Returns all products whose name contains "Crustafarian" and source is printify,
 * with id, name, printifyProductId. Used by fix-crustafarian-printify-products.ts.
 */

import { and, eq, ilike, isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      printifyProductId: productsTable.printifyProductId,
    })
    .from(productsTable)
    .where(
      and(
        ilike(productsTable.name, "%Crustafarian%"),
        eq(productsTable.source, "printify"),
        isNotNull(productsTable.printifyProductId),
      ),
    );

  const products = rows
    .filter((r) => r.printifyProductId != null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      printifyProductId: r.printifyProductId!,
    }));

  return NextResponse.json({ products });
}
