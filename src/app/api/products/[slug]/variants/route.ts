import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";

/**
 * Get product variants by product slug.
 * Example: GET /api/products/mens-bitcoin-hodl-tee/variants
 * GET /api/products/[slug]/variants
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: slugParam } = await params;
    if (!slugParam?.trim()) {
      return NextResponse.json({ error: "slug required" }, { status: 400 });
    }

    const slug = slugParam.trim();

    const [product] = await db
      .select({ hasVariants: productsTable.hasVariants, id: productsTable.id })
      .from(productsTable)
      .where(
        and(
          eq(productsTable.published, true),
          or(eq(productsTable.id, slug), eq(productsTable.slug, slug)),
        ),
      )
      .limit(1);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.hasVariants) {
      return NextResponse.json({ variants: [] });
    }

    const variants = await db
      .select({
        color: productVariantsTable.color,
        gender: productVariantsTable.gender,
        id: productVariantsTable.id,
        imageUrl: productVariantsTable.imageUrl,
        priceCents: productVariantsTable.priceCents,
        size: productVariantsTable.size,
        stockQuantity: productVariantsTable.stockQuantity,
      })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, product.id));

    return NextResponse.json({
      variants: variants.map((v) => ({
        color: v.color ?? undefined,
        gender: v.gender ?? undefined,
        id: v.id,
        imageUrl: v.imageUrl ?? undefined,
        priceCents: v.priceCents,
        size: v.size ?? undefined,
        stockQuantity: v.stockQuantity ?? undefined,
      })),
    });
  } catch (err) {
    console.error("Product variants error:", err);
    return NextResponse.json(
      { error: "Failed to load variants" },
      { status: 500 },
    );
  }
}
