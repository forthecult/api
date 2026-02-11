import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  orderItemsTable,
  ordersTable,
  productCategoriesTable,
  productVariantsTable,
  productsTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";

/** Normalize email for ownership check. */
function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * GET /api/orders/[orderId]/reorder
 * Returns cart-compatible item data for the order. Requires authenticated owner.
 * Used by the Reorder button to add items back to the cart.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params;
    if (!orderId?.trim()) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to reorder" } },
        { status: 401 },
      );
    }

    const [order] = await db
      .select({
        id: ordersTable.id,
        email: ordersTable.email,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId.trim()))
      .limit(1);

    if (!order) {
      return NextResponse.json(
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found" } },
        { status: 404 },
      );
    }

    const emailVerified = (session.user as { emailVerified?: boolean })?.emailVerified;
    const isOwner =
      order.userId === session.user.id ||
      (emailVerified && normalizeEmail(order.email) === normalizeEmail(session.user.email));

    if (!isOwner) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authorized to reorder this order" } },
        { status: 401 },
      );
    }

    const items = await db
      .select({
        productId: orderItemsTable.productId,
        productVariantId: orderItemsTable.productVariantId,
        quantity: orderItemsTable.quantity,
      })
      .from(orderItemsTable)
      .where(eq(orderItemsTable.orderId, order.id));

    const result: Array<{
      productId: string;
      productVariantId?: string;
      quantity: number;
      name: string;
      image: string;
      slug?: string;
      category: string;
      priceUsd: number;
      available: boolean;
      unavailableReason?: string;
    }> = [];

    for (const item of items) {
      const pid = item.productId;
      if (!pid) {
        result.push({
          productId: "",
          productVariantId: item.productVariantId ?? undefined,
          quantity: item.quantity,
          name: "Unknown product",
          image: "",
          category: "",
          priceUsd: 0,
          available: false,
          unavailableReason: "Product no longer available",
        });
        continue;
      }

      const [product] = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          imageUrl: productsTable.imageUrl,
          slug: productsTable.slug,
          published: productsTable.published,
          priceCents: productsTable.priceCents,
          continueSellingWhenOutOfStock: productsTable.continueSellingWhenOutOfStock,
          trackQuantity: productsTable.trackQuantity,
          quantity: productsTable.quantity,
        })
        .from(productsTable)
        .where(eq(productsTable.id, pid))
        .limit(1);

      if (!product || !product.published) {
        result.push({
          productId: pid,
          productVariantId: item.productVariantId ?? undefined,
          quantity: item.quantity,
          name: "Unavailable",
          image: "",
          category: "",
          priceUsd: 0,
          available: false,
          unavailableReason: "Product no longer available",
        });
        continue;
      }

      let priceCents = product.priceCents;
      let imageUrl = product.imageUrl ?? "";
      let variantId: string | undefined = item.productVariantId ?? undefined;

      if (item.productVariantId) {
        const [variant] = await db
          .select({
            id: productVariantsTable.id,
            priceCents: productVariantsTable.priceCents,
            imageUrl: productVariantsTable.imageUrl,
            stockQuantity: productVariantsTable.stockQuantity,
          })
          .from(productVariantsTable)
          .where(
            and(
              eq(productVariantsTable.id, item.productVariantId),
              eq(productVariantsTable.productId, pid),
            ),
          )
          .limit(1);

        if (variant) {
          priceCents = variant.priceCents;
          if (variant.imageUrl) imageUrl = variant.imageUrl;
          variantId = variant.id;
        }
      }

      const [catRow] = await db
        .select({ categoryName: categoriesTable.name })
        .from(productCategoriesTable)
        .innerJoin(
          categoriesTable,
          eq(productCategoriesTable.categoryId, categoriesTable.id),
        )
        .where(
          and(
            eq(productCategoriesTable.productId, pid),
            eq(productCategoriesTable.isMain, true),
          ),
        )
        .limit(1);

      const category = catRow?.categoryName ?? "";
      const priceUsd = priceCents / 100;
      const inStock = product.trackQuantity
        ? (product.quantity ?? 0) > 0
        : true;

      result.push({
        productId: pid,
        productVariantId: variantId,
        quantity: item.quantity,
        name: product.name,
        image: imageUrl || "/placeholder.svg",
        slug: product.slug ?? undefined,
        category,
        priceUsd,
        available: inStock || product.continueSellingWhenOutOfStock,
        unavailableReason:
          !inStock && !product.continueSellingWhenOutOfStock
            ? "Out of stock"
            : undefined,
      });
    }

    return NextResponse.json({ items: result });
  } catch (err) {
    console.error("Reorder error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load order for reorder" } },
      { status: 500 },
    );
  }
}
