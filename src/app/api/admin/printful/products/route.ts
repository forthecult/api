import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { fetchSyncProduct, getPrintfulIfConfigured } from "~/lib/printful";
import {
  getProductSyncStatus,
  listAvailablePrintfulProducts,
} from "~/lib/printful-sync";

/**
 * GET /api/admin/printful/products
 *
 * List Printful sync products.
 *
 * Query params:
 * - source=printful: List local products from Printful source
 * - source=api: List products available in Printful API (not yet imported)
 * - id=<productId>: Get sync status for a specific local product
 * - printfulId=<id>: Get full details from Printful API
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const productId = searchParams.get("id");
  const printfulId = searchParams.get("printfulId");

  // Get sync status for a specific product
  if (productId) {
    const status = await getProductSyncStatus(productId);
    return NextResponse.json(status);
  }

  // Get full Printful product details
  if (printfulId) {
    try {
      const product = await fetchSyncProduct(printfulId);
      return NextResponse.json(product);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // List local Printful products
  if (source === "printful" || !source) {
    const products = await db
      .select({
        createdAt: productsTable.createdAt,
        id: productsTable.id,
        imageUrl: productsTable.imageUrl,
        lastSyncedAt: productsTable.lastSyncedAt,
        name: productsTable.name,
        priceCents: productsTable.priceCents,
        printfulSyncProductId: productsTable.printfulSyncProductId,
        published: productsTable.published,
        slug: productsTable.slug,
        updatedAt: productsTable.updatedAt,
      })
      .from(productsTable)
      .where(eq(productsTable.source, "printful"))
      .orderBy(productsTable.createdAt);

    // Get variant counts
    const productsWithVariants = await Promise.all(
      products.map(async (p) => {
        const variants = await db
          .select({ id: productVariantsTable.id })
          .from(productVariantsTable)
          .where(eq(productVariantsTable.productId, p.id));
        return { ...p, variantCount: variants.length };
      }),
    );

    return NextResponse.json({
      count: productsWithVariants.length,
      products: productsWithVariants,
      source: "local",
    });
  }

  // List products from Printful API
  if (source === "api") {
    const { error, products } = await listAvailablePrintfulProducts();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    // Check which ones are already imported
    const importedIds = new Set<number>();
    const localProducts = await db
      .select({ printfulSyncProductId: productsTable.printfulSyncProductId })
      .from(productsTable)
      .where(eq(productsTable.source, "printful"));

    for (const lp of localProducts) {
      if (lp.printfulSyncProductId) {
        importedIds.add(lp.printfulSyncProductId);
      }
    }

    const productsWithImportStatus = products.map((p) => ({
      ...p,
      imported: importedIds.has(p.id),
    }));

    return NextResponse.json({
      count: productsWithImportStatus.length,
      products: productsWithImportStatus,
      source: "printful_api",
    });
  }

  return NextResponse.json(
    { error: "Invalid source. Use 'printful' or 'api'." },
    { status: 400 },
  );
}
