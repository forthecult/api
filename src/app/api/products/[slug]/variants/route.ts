import { and, eq, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productVariantsTable, productsTable } from "~/db/schema";

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
      .select({ id: productsTable.id, hasVariants: productsTable.hasVariants })
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
        id: productVariantsTable.id,
        size: productVariantsTable.size,
        color: productVariantsTable.color,
        priceCents: productVariantsTable.priceCents,
        stockQuantity: productVariantsTable.stockQuantity,
        imageUrl: productVariantsTable.imageUrl,
      })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, product.id));

    return NextResponse.json({
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size ?? undefined,
        color: v.color ?? undefined,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity ?? undefined,
        imageUrl: v.imageUrl ?? undefined,
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
