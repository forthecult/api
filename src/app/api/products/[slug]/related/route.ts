import { and, eq, inArray, ne, notInArray, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import {
  categoriesTable,
  productCategoriesTable,
  productsTable,
  productTagsTable,
} from "~/db/schema";

const RELATED_LIMIT = 4;

/**
 * Related products by shared tags; fallback to same category, then any published.
 * Example: GET /api/products/mens-bitcoin-hodl-tee/related
 * GET /api/products/[slug]/related
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
      .select({ id: productsTable.id })
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

    const id = product.id;

    // 1) Tags for this product
    const myTags = await db
      .select({ tag: productTagsTable.tag })
      .from(productTagsTable)
      .where(eq(productTagsTable.productId, id));
    const tagList = myTags.map((r) => r.tag).filter(Boolean);

    const collected: Array<{
      id: string;
      slug: string | null;
      name: string;
      imageUrl: string | null;
      priceCents: number;
      compareAtPriceCents: number | null;
      categoryName: string;
      tokenGated: boolean;
    }> = [];
    const seenIds = new Set<string>([id]);

    // 2) Products that share at least one tag
    if (tagList.length > 0) {
      const byTag = await db
        .select({
          id: productsTable.id,
          slug: productsTable.slug,
          name: productsTable.name,
          imageUrl: productsTable.imageUrl,
          priceCents: productsTable.priceCents,
          compareAtPriceCents: productsTable.compareAtPriceCents,
          tokenGated: productsTable.tokenGated,
        })
        .from(productsTable)
        .innerJoin(
          productTagsTable,
          eq(productsTable.id, productTagsTable.productId),
        )
        .where(
          and(
            eq(productsTable.published, true),
            ne(productsTable.id, id),
            inArray(productTagsTable.tag, tagList),
          ),
        )
        .limit(RELATED_LIMIT * 2);

      const mainCats = await db
        .select({
          productId: productCategoriesTable.productId,
          categoryName: categoriesTable.name,
        })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(
          and(
            eq(productCategoriesTable.isMain, true),
            inArray(
              productCategoriesTable.productId,
              byTag.map((p) => p.id),
            ),
          ),
        );
      const categoryByProductId = new Map(
        mainCats.map((c) => [c.productId, c.categoryName]),
      );

      for (const p of byTag) {
        if (collected.length >= RELATED_LIMIT) break;
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        collected.push({
          id: p.id,
          slug: p.slug,
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          compareAtPriceCents: p.compareAtPriceCents,
          categoryName: categoryByProductId.get(p.id) ?? "Uncategorized",
          tokenGated: p.tokenGated ?? false,
        });
      }
    }

    // 3) Fallback: same category (main first, then any shared category)
    if (collected.length < RELATED_LIMIT) {
      const myCategoryRows = await db
        .select({ categoryId: productCategoriesTable.categoryId })
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.productId, id));
      const myCategoryIds = myCategoryRows.map((r) => r.categoryId).filter(Boolean);

      if (myCategoryIds.length > 0) {
        const sameCategory = await db
          .select({
            id: productsTable.id,
            slug: productsTable.slug,
            name: productsTable.name,
            imageUrl: productsTable.imageUrl,
            priceCents: productsTable.priceCents,
            compareAtPriceCents: productsTable.compareAtPriceCents,
            categoryName: categoriesTable.name,
            tokenGated: productsTable.tokenGated,
          })
          .from(productsTable)
          .innerJoin(
            productCategoriesTable,
            eq(productsTable.id, productCategoriesTable.productId),
          )
          .innerJoin(
            categoriesTable,
            eq(productCategoriesTable.categoryId, categoriesTable.id),
          )
          .where(
            and(
              eq(productsTable.published, true),
              inArray(productCategoriesTable.categoryId, myCategoryIds),
              ne(productsTable.id, id),
            ),
          )
          .limit((RELATED_LIMIT - collected.length) * 3);

        for (const p of sameCategory) {
          if (collected.length >= RELATED_LIMIT) break;
          if (seenIds.has(p.id)) continue;
          seenIds.add(p.id);
          collected.push({
            id: p.id,
            slug: p.slug,
            name: p.name,
            imageUrl: p.imageUrl,
            priceCents: p.priceCents,
            compareAtPriceCents: p.compareAtPriceCents,
            categoryName: p.categoryName,
            tokenGated: p.tokenGated ?? false,
          });
        }
      }
    }

    // 4) Fallback: any published products
    if (collected.length < RELATED_LIMIT) {
      const excludeIds = Array.from(seenIds);
      const anyPublished = await db
        .select({
          id: productsTable.id,
          slug: productsTable.slug,
          name: productsTable.name,
          imageUrl: productsTable.imageUrl,
          priceCents: productsTable.priceCents,
          compareAtPriceCents: productsTable.compareAtPriceCents,
          tokenGated: productsTable.tokenGated,
        })
        .from(productsTable)
        .where(
          and(
            eq(productsTable.published, true),
            excludeIds.length > 0
              ? notInArray(productsTable.id, excludeIds)
              : undefined,
          ),
        )
        .limit(RELATED_LIMIT - collected.length);

      const mainCatsAny = await db
        .select({
          productId: productCategoriesTable.productId,
          categoryName: categoriesTable.name,
        })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(
          and(
            eq(productCategoriesTable.isMain, true),
            inArray(
              productCategoriesTable.productId,
              anyPublished.map((p) => p.id),
            ),
          ),
        );
      const categoryByProductId = new Map(
        mainCatsAny.map((c) => [c.productId, c.categoryName]),
      );

      for (const p of anyPublished) {
        if (collected.length >= RELATED_LIMIT) break;
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        collected.push({
          id: p.id,
          slug: p.slug,
          name: p.name,
          imageUrl: p.imageUrl,
          priceCents: p.priceCents,
          compareAtPriceCents: p.compareAtPriceCents,
          categoryName: categoryByProductId.get(p.id) ?? "Uncategorized",
          tokenGated: p.tokenGated ?? false,
        });
      }
    }

    const cookieHeader = _request.headers.get("cookie") ?? "";
    const tgCookieMatch = cookieHeader
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.toLowerCase().startsWith("tg="));
    const tgCookieValue = tgCookieMatch
      ? decodeURIComponent(tgCookieMatch.slice(tgCookieMatch.indexOf("=") + 1).trim())
      : undefined;

    const items = collected.slice(0, RELATED_LIMIT).map((p) => {
      const resourceId = p.slug ?? p.id;
      const tokenGatePassed =
        p.tokenGated &&
        hasValidTokenGateCookie(tgCookieValue, "product", resourceId);
      return {
        id: p.id,
        slug: p.slug ?? p.id,
        name: p.name,
        category: p.categoryName,
        image: p.imageUrl ?? "/placeholder.svg",
        price: p.priceCents / 100,
        originalPrice:
          p.compareAtPriceCents != null ? p.compareAtPriceCents / 100 : undefined,
        inStock: true,
        rating: 0,
        tokenGated: p.tokenGated,
        tokenGatePassed: tokenGatePassed ?? false,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Related products error:", err);
    return NextResponse.json(
      { error: "Failed to load related products" },
      { status: 500 },
    );
  }
}
