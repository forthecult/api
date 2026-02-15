/**
 * GET /api/admin/products/soluna-printify
 *
 * Returns all products that have tag "SOLUNA" and source "printify" with
 * id, printifyProductId, and name. Used by scripts that update SOLUNA
 * Printify products (e.g. update-soluna-printfile-and-mockups).
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable, productTagsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const solunaProductIds = await db
    .select({ productId: productTagsTable.productId })
    .from(productTagsTable)
    .where(eq(productTagsTable.tag, "SOLUNA"));
  const ids = [...new Set(solunaProductIds.map((r) => r.productId))];
  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      printifyProductId: productsTable.printifyProductId,
    })
    .from(productsTable)
    .where(
      and(
        inArray(productsTable.id, ids),
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
