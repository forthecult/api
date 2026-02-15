import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  productsTable,
  productTagsTable,
  productVariantsTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { fetchPrintifyProduct, getPrintifyIfConfigured } from "~/lib/printify";
import {
  getPrintifyProductSyncStatus,
  listAvailablePrintifyProducts,
} from "~/lib/printify-sync";

/**
 * GET /api/admin/printify/products
 *
 * List Printify products.
 *
 * Query params:
 * - source=printify: List local products from Printify source
 * - source=api: List products available in Printify API (not yet imported)
 * - id=<productId>: Get sync status for a specific local product
 * - printifyId=<id>: Get full details from Printify API
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      {
        error:
          "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID.",
      },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const tag = searchParams.get("tag")?.trim();
  const productId = searchParams.get("id");
  const printifyId = searchParams.get("printifyId");

  // Get sync status for a specific product
  if (productId) {
    const status = await getPrintifyProductSyncStatus(productId);
    return NextResponse.json(status);
  }

  // Get full Printify product details
  if (printifyId) {
    try {
      const product = await fetchPrintifyProduct(pf.shopId, printifyId);
      return NextResponse.json(product);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // List local Printify products (optional filter by tag)
  if (source === "printify" || !source) {
    let productIdsFilter: string[] | undefined;
    if (tag) {
      const tagged = await db
        .select({ productId: productTagsTable.productId })
        .from(productTagsTable)
        .where(eq(productTagsTable.tag, tag));
      productIdsFilter = [...new Set(tagged.map((r) => r.productId))];
      if (productIdsFilter.length === 0) {
        return NextResponse.json({
          count: 0,
          products: [],
          source: "local",
        });
      }
    }
    const products = await db
      .select({
        createdAt: productsTable.createdAt,
        id: productsTable.id,
        imageUrl: productsTable.imageUrl,
        lastSyncedAt: productsTable.lastSyncedAt,
        name: productsTable.name,
        priceCents: productsTable.priceCents,
        printifyProductId: productsTable.printifyProductId,
        published: productsTable.published,
        slug: productsTable.slug,
        updatedAt: productsTable.updatedAt,
      })
      .from(productsTable)
      .where(
        productIdsFilter
          ? and(
              eq(productsTable.source, "printify"),
              isNotNull(productsTable.printifyProductId),
              inArray(productsTable.id, productIdsFilter),
            )
          : eq(productsTable.source, "printify"),
      )
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

  // List products from Printify API
  if (source === "api") {
    const { error, products } = await listAvailablePrintifyProducts();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    // Check which ones are already imported
    const importedIds = new Set<string>();
    const localProducts = await db
      .select({ printifyProductId: productsTable.printifyProductId })
      .from(productsTable)
      .where(eq(productsTable.source, "printify"));

    for (const lp of localProducts) {
      if (lp.printifyProductId) {
        importedIds.add(lp.printifyProductId);
      }
    }

    const productsWithImportStatus = products.map((p) => ({
      blueprint_id: p.blueprint_id,
      description: p.description?.slice(0, 200),
      enabled_variant_count: p.variants.filter((v) => v.is_enabled).length,
      id: p.id,
      image: p.images[0]?.src || null,
      imported: importedIds.has(p.id),
      title: p.title,
      variant_count: p.variants.length,
      visible: p.visible,
    }));

    return NextResponse.json({
      count: productsWithImportStatus.length,
      products: productsWithImportStatus,
      source: "printify_api",
    });
  }

  return NextResponse.json(
    { error: "Invalid source. Use 'printify' or 'api'." },
    { status: 400 },
  );
}
