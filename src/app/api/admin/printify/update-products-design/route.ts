/**
 * POST /api/admin/printify/update-products-design
 *
 * Store <-> Printify: update design for all Printify products matching a tag,
 * then sync, re-host mockups to UploadThing, and set categories/features/SEO.
 * All work is done server-side (DB, Printify, UploadThing).
 *
 * Body: { imageId: string, tag?: string }
 * - imageId: Printify upload id (from POST /api/admin/pod/upload?makeTransparent=true)
 * - tag: product tag to filter (default "SOLUNA")
 *
 * Flow: 1) Update design + publish for each product. 2) Wait 2 min. 3) Sync each.
 * 4) Upload mockups to UploadThing. 5) Patch categories, features, SEO.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
  productTagsTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchPrintifyProduct,
  updatePrintifyProduct,
  publishPrintifyProduct,
  getPrintifyIfConfigured,
} from "~/lib/printify";
import { importSinglePrintifyProduct } from "~/lib/printify-sync";
import { triggerMockupUploadForProduct } from "~/lib/upload-product-mockups";

const MOCKUP_WAIT_MS = 120_000;

function productLabelFromName(name: string): string {
  return name.replace(/^SOLUNA\s+/i, "").trim() || name;
}

function buildFeatures(productLabel: string): string[] {
  return [
    `Official SOLUNA (Solana meme) ${productLabel.toLowerCase()} design`,
    "Vibrant gradient SOLUNA logo — teal, fuchsia, purple",
    "Premium quality; made to order",
    "Pay with SOL, USDC, or card",
  ];
}

function buildSeo(productLabel: string): {
  pageTitle: string;
  metaDescription: string;
} {
  const title = `SOLUNA ${productLabel}`;
  return {
    pageTitle: `${title} — Solana Meme Merch | Culture`,
    metaDescription: `${title}. SOLUNA is the meme of Solana. Premium quality, vibrant design. Pay with SOL, USDC, or card. Culture.`,
  };
}

export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured." },
      { status: 400 },
    );
  }

  let body: { imageId?: string; tag?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const imageId = body.imageId?.trim();
  if (!imageId) {
    return NextResponse.json(
      { error: "body.imageId is required" },
      { status: 400 },
    );
  }

  const tag = body.tag?.trim() || "SOLUNA";

  type ProductRow = { id: string; printifyProductId: string; name: string };
  let products: ProductRow[];

  const tagged = await db
    .select({ productId: productTagsTable.productId })
    .from(productTagsTable)
    .where(eq(productTagsTable.tag, tag));
  const ids = [...new Set(tagged.map((r) => r.productId))];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: `No products found with tag "${tag}"` },
      { status: 400 },
    );
  }

  const rows = await db
    .select({
      id: productsTable.id,
      printifyProductId: productsTable.printifyProductId,
      name: productsTable.name,
    })
    .from(productsTable)
    .where(
      and(
        inArray(productsTable.id, ids),
        eq(productsTable.source, "printify"),
        isNotNull(productsTable.printifyProductId),
      ),
    );
  products = rows
    .filter((r): r is ProductRow => r.printifyProductId != null)
    .map((r) => ({
      id: r.id,
      printifyProductId: r.printifyProductId!,
      name: r.name,
    }));

  if (products.length === 0) {
    return NextResponse.json(
      { error: `No Printify products with tag "${tag}"` },
      { status: 400 },
    );
  }

  const results = {
    designUpdated: 0,
    synced: 0,
    mockupsUploaded: 0,
    patched: 0,
    errors: [] as string[],
  };

  for (const p of products) {
    try {
      const product = await fetchPrintifyProduct(
        pf.shopId,
        p.printifyProductId,
      );
      const print_areas = product.print_areas.map((pa) => ({
        variant_ids: pa.variant_ids,
        placeholders: pa.placeholders.map((ph) => ({
          position: ph.position,
          images: ph.images.map((img) => ({
            id: imageId,
            x: img.x,
            y: img.y,
            scale: img.scale,
            angle: img.angle,
          })),
        })),
      }));
      await updatePrintifyProduct(pf.shopId, p.printifyProductId, {
        print_areas,
      });
      await publishPrintifyProduct(pf.shopId, p.printifyProductId).catch(
        () => {},
      );
      results.designUpdated++;
    } catch (err) {
      results.errors.push(
        `design ${p.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await new Promise((r) => setTimeout(r, MOCKUP_WAIT_MS));

  for (const p of products) {
    try {
      await importSinglePrintifyProduct(p.printifyProductId, true);
      results.synced++;
    } catch (err) {
      results.errors.push(
        `sync ${p.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  for (const p of products) {
    try {
      const { uploaded } = await triggerMockupUploadForProduct(p.id);
      if (uploaded && uploaded > 0) results.mockupsUploaded += uploaded;
    } catch {
      // non-fatal
    }
  }

  const categoryRows = await db
    .select({
      id: categoriesTable.id,
      slug: categoriesTable.slug,
      name: categoriesTable.name,
    })
    .from(categoriesTable);
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of categoryRows) {
    if (c.slug) bySlug.set(c.slug.toLowerCase(), c.id);
    byName.set(c.name.toLowerCase(), c.id);
  }
  const solunaId = bySlug.get("soluna") ?? byName.get("soluna") ?? null;
  const solanaId = bySlug.get("solana") ?? byName.get("solana") ?? null;
  const glasswareId =
    bySlug.get("glassware") ?? byName.get("glassware") ?? null;
  const stickersId = bySlug.get("stickers") ?? byName.get("stickers") ?? null;

  for (const p of products) {
    try {
      const label = productLabelFromName(p.name);
      const features = buildFeatures(label);
      const seo = buildSeo(label);
      const categoryIds: string[] = [];
      if (solunaId) categoryIds.push(solunaId);
      if (solanaId) categoryIds.push(solanaId);
      if (
        label.toLowerCase().includes("shot") &&
        label.toLowerCase().includes("glass") &&
        glasswareId
      ) {
        categoryIds.push(glasswareId);
      }
      if (label.toLowerCase().includes("sticker") && stickersId) {
        categoryIds.push(stickersId);
      }
      const mainCategoryId = solunaId ?? categoryIds[0] ?? null;

      await db
        .update(productsTable)
        .set({
          featuresJson: features.length > 0 ? JSON.stringify(features) : null,
          pageTitle: seo.pageTitle,
          metaDescription: seo.metaDescription,
          seoOptimized: true,
          updatedAt: new Date(),
        })
        .where(eq(productsTable.id, p.id));

      await db
        .delete(productCategoriesTable)
        .where(eq(productCategoriesTable.productId, p.id));
      if (categoryIds.length > 0) {
        await db.insert(productCategoriesTable).values(
          categoryIds.map((categoryId) => ({
            productId: p.id,
            categoryId,
            isMain: categoryId === mainCategoryId,
          })),
        );
      }
      results.patched++;
    } catch (err) {
      results.errors.push(
        `patch ${p.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Design updated, synced, mockups uploaded, categories/SEO set.",
    products: products.length,
    ...results,
  });
}
