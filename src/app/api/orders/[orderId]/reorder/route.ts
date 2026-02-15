import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  orderItemsTable,
  ordersTable,
  productCategoriesTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";

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
        email: ordersTable.email,
        id: ordersTable.id,
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

    const emailVerified = (session.user as { emailVerified?: boolean })
      ?.emailVerified;
    const isOwner =
      order.userId === session.user.id ||
      (emailVerified &&
        normalizeEmail(order.email) === normalizeEmail(session.user.email));

    if (!isOwner) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Not authorized to reorder this order",
          },
        },
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

    const result: {
      available: boolean;
      category: string;
      image: string;
      name: string;
      priceUsd: number;
      productId: string;
      productVariantId?: string;
      quantity: number;
      slug?: string;
      unavailableReason?: string;
    }[] = [];

    for (const item of items) {
      const pid = item.productId;
      if (!pid) {
        result.push({
          available: false,
          category: "",
          image: "",
          name: "Unknown product",
          priceUsd: 0,
          productId: "",
          productVariantId: item.productVariantId ?? undefined,
          quantity: item.quantity,
          unavailableReason: "Product no longer available",
        });
        continue;
      }

      const [product] = await db
        .select({
          continueSellingWhenOutOfStock:
            productsTable.continueSellingWhenOutOfStock,
          id: productsTable.id,
          imageUrl: productsTable.imageUrl,
          name: productsTable.name,
          priceCents: productsTable.priceCents,
          published: productsTable.published,
          quantity: productsTable.quantity,
          slug: productsTable.slug,
          trackQuantity: productsTable.trackQuantity,
        })
        .from(productsTable)
        .where(eq(productsTable.id, pid))
        .limit(1);

      if (!product || !product.published) {
        result.push({
          available: false,
          category: "",
          image: "",
          name: "Unavailable",
          priceUsd: 0,
          productId: pid,
          productVariantId: item.productVariantId ?? undefined,
          quantity: item.quantity,
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
            imageUrl: productVariantsTable.imageUrl,
            priceCents: productVariantsTable.priceCents,
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
        available: inStock || product.continueSellingWhenOutOfStock,
        category,
        image: imageUrl || "/placeholder.svg",
        name: product.name,
        priceUsd,
        productId: pid,
        productVariantId: variantId,
        quantity: item.quantity,
        slug: product.slug ?? undefined,
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
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to load order for reorder",
        },
      },
      { status: 500 },
    );
  }
}

/** Normalize email for ownership check. */
function normalizeEmail(email: null | string | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
