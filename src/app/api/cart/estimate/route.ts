import { type NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";
import { apiError, apiSuccess, validateRequired } from "~/lib/api-error";

interface EstimateItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface EstimateRequest {
  items: EstimateItem[];
  shipping?: {
    countryCode: string;
    zip?: string;
  };
  currency?: "USD"; // Only USD supported for now
}

/**
 * POST /api/cart/estimate
 *
 * Preview cart totals before checkout. AI-friendly endpoint that returns
 * subtotals, shipping estimates, and crypto conversion amounts.
 *
 * Use this to show users "Your total will be $X" before they commit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EstimateRequest;

    // Validate required fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return apiError("EMPTY_CART");
    }

    // Validate items
    for (const item of body.items) {
      if (
        !item.productId ||
        typeof item.quantity !== "number" ||
        item.quantity < 1
      ) {
        return apiError("INVALID_CART", {
          item,
          reason: "Each item must have productId and positive quantity",
        });
      }
    }

    // Fetch products
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const products = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        priceCents: productsTable.priceCents,
        published: productsTable.published,
      })
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Fetch variants if any
    const variantIds = body.items
      .map((i) => i.variantId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    const variants =
      variantIds.length > 0
        ? await db
            .select({
              id: productVariantsTable.id,
              productId: productVariantsTable.productId,
              priceCents: productVariantsTable.priceCents,
            })
            .from(productVariantsTable)
            .where(inArray(productVariantsTable.id, variantIds))
        : [];

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Calculate line items
    const lineItems: Array<{
      productId: string;
      variantId?: string;
      name: string;
      quantity: number;
      unitPriceCents: number;
      subtotalCents: number;
    }> = [];

    let subtotalCents = 0;

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return apiError("PRODUCT_NOT_FOUND", { productId: item.productId });
      }
      if (!product.published) {
        return apiError("PRODUCT_UNAVAILABLE", { productId: item.productId });
      }

      let unitPriceCents = product.priceCents;
      let variantName = "";

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant) {
          return apiError("VARIANT_NOT_FOUND", {
            productId: item.productId,
            variantId: item.variantId,
          });
        }
        if (variant.productId !== item.productId) {
          return apiError("VARIANT_NOT_FOUND", {
            reason: "Variant does not belong to this product",
            productId: item.productId,
            variantId: item.variantId,
          });
        }
        unitPriceCents = variant.priceCents;
        variantName = "";
      }

      const itemSubtotal = unitPriceCents * item.quantity;
      subtotalCents += itemSubtotal;

      lineItems.push({
        productId: item.productId,
        ...(item.variantId && { variantId: item.variantId }),
        name: product.name + variantName,
        quantity: item.quantity,
        unitPriceCents,
        subtotalCents: itemSubtotal,
      });
    }

    // Calculate shipping (simplified - use shipping calculator for accurate)
    let shippingCents = 0;
    let shippingMethod = "Standard";
    let estimatedDays = "5-10 business days";

    if (body.shipping?.countryCode) {
      const country = body.shipping.countryCode.toUpperCase();
      if (country === "US") {
        shippingCents = subtotalCents >= 5000 ? 0 : 599; // Free shipping over $50
        estimatedDays = "3-5 business days";
      } else if (["CA", "GB", "AU", "DE", "FR"].includes(country)) {
        shippingCents = subtotalCents >= 10000 ? 0 : 1499; // Free shipping over $100
        estimatedDays = "7-14 business days";
      } else {
        shippingCents = 1999;
        estimatedDays = "14-21 business days";
      }

      if (shippingCents === 0) {
        shippingMethod = "Free Shipping";
      }
    }

    const totalCents = subtotalCents + shippingCents;

    // Fetch crypto prices (simplified - use actual price feeds in production)
    const ethPrice = 3500; // Placeholder
    const solPrice = 180; // Placeholder

    const totalUsd = totalCents / 100;
    const cryptoPrices = {
      SOL: (totalUsd / solPrice).toFixed(4),
      USDC: totalUsd.toFixed(2),
      USDT: totalUsd.toFixed(2),
      ETH: (totalUsd / ethPrice).toFixed(6),
    };

    // Response
    const response = {
      items: lineItems.map((item) => ({
        ...item,
        unitPrice: { usd: item.unitPriceCents / 100 },
        subtotal: { usd: item.subtotalCents / 100 },
      })),
      subtotal: { usd: subtotalCents / 100 },
      shipping: {
        usd: shippingCents / 100,
        method: shippingMethod,
        estimatedDays,
        ...(body.shipping?.countryCode && {
          countryCode: body.shipping.countryCode,
        }),
      },
      tax: { usd: 0, note: "Tax calculated at checkout if applicable" },
      total: { usd: totalUsd },
      crypto: cryptoPrices,
      validFor: "15 minutes",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      _note: "Prices are estimates. Final amounts calculated at checkout.",
      _actions: {
        checkout: "POST /api/checkout",
        searchProducts: "POST /api/products/search",
        getProduct: "GET /api/products/{slug}",
      },
    };

    return apiSuccess(response);
  } catch (err) {
    console.error("Cart estimate error:", err);
    return apiError("INTERNAL_ERROR");
  }
}
