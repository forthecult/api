import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  getAmazonProduct,
  isAmazonProductApiConfigured,
} from "~/lib/amazon-product-api";
import { slugify } from "~/lib/slugify";

/**
 * POST /api/admin/products/import-amazon
 * Import an Amazon product by ASIN into the store catalog.
 *
 * Body: { asin: string }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    if (!isAmazonProductApiConfigured()) {
      return NextResponse.json(
        { error: "Amazon API not configured" },
        { status: 503 },
      );
    }

    const body = (await request.json()) as { asin?: string };
    const asin = body.asin?.trim().toUpperCase();

    if (!asin) {
      return NextResponse.json(
        { error: "Missing required field: asin" },
        { status: 400 },
      );
    }

    // check if already imported
    const [existing] = await db
      .select({ id: productsTable.id, name: productsTable.name })
      .from(productsTable)
      .where(eq(productsTable.amazonAsin, asin))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          error: "Product already imported",
          existingProductId: existing.id,
          existingProductName: existing.name,
        },
        { status: 409 },
      );
    }

    // fetch from Amazon
    const amazonProduct = await getAmazonProduct(asin);
    if (!amazonProduct) {
      return NextResponse.json(
        { error: "Product not found on Amazon or unavailable" },
        { status: 404 },
      );
    }

    const now = new Date();
    const id = nanoid();
    const baseSlug = slugify(amazonProduct.name);
    const slug = `${baseSlug}-${id.slice(0, 6)}`;

    const priceCents = Math.round(amazonProduct.price.usd * 100);

    await db.insert(productsTable).values({
      amazonAsin: asin,
      amazonPriceRefreshedAt: now,
      continueSellingWhenOutOfStock: true,
      createdAt: now,
      id,
      imageUrl: amazonProduct.imageUrl,
      name: amazonProduct.name,
      priceCents,
      published: false, // admin should review before publishing
      slug,
      source: "amazon",
      updatedAt: now,
    });

    return NextResponse.json({
      message: "Product imported successfully",
      product: {
        asin,
        id,
        imageUrl: amazonProduct.imageUrl,
        name: amazonProduct.name,
        priceUsd: amazonProduct.price.usd,
        productUrl: amazonProduct.productUrl,
        slug,
      },
    });
  } catch (err) {
    console.error("Import Amazon product error:", err);
    return NextResponse.json(
      { error: "Failed to import product" },
      { status: 500 },
    );
  }
}
