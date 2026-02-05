/**
 * Printful Order Management Service
 *
 * Handles creating, confirming, and canceling orders with Printful.
 * Called after payment is confirmed to send orders for fulfillment.
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import {
  createPrintfulOrder,
  confirmPrintfulOrder,
  getPrintfulIfConfigured,
  type PrintfulCreateOrderRequest,
  type PrintfulOrderItem,
  type PrintfulRecipient,
} from "~/lib/printful";
import { onOrderStatusUpdate } from "~/lib/create-user-notification";

export type PrintfulOrderResult = {
  success: boolean;
  printfulOrderId?: number;
  error?: string;
};

/**
 * Check if any order items are Printful products
 */
export async function hasPrintfulItems(orderId: string): Promise<boolean> {
  const items = await db
    .select({
      productId: orderItemsTable.productId,
      productVariantId: orderItemsTable.productVariantId,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));

  if (items.length === 0) return false;

  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is string => id != null);

  if (productIds.length === 0) return false;

  const products = await db
    .select({ id: productsTable.id, source: productsTable.source })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  return products.some((p) => p.source === "printful");
}

/**
 * Get Printful items from an order with their catalog variant IDs
 */
export async function getPrintfulOrderItems(orderId: string): Promise<
  Array<{
    orderItemId: string;
    productId: string;
    productVariantId: string | null;
    catalogVariantId: number;
    quantity: number;
    name: string;
    priceCents: number;
  }>
> {
  // Get order items
  const items = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));

  if (items.length === 0) return [];

  // Get products to check source
  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is string => id != null);

  if (productIds.length === 0) return [];

  const products = await db
    .select({
      id: productsTable.id,
      source: productsTable.source,
      externalId: productsTable.externalId,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  const printfulProductIds = new Set(
    products.filter((p) => p.source === "printful").map((p) => p.id),
  );

  // Get variant external IDs for items with variants
  const variantIds = items
    .map((i) => i.productVariantId)
    .filter((id): id is string => id != null);

  const variants =
    variantIds.length > 0
      ? await db
          .select({
            id: productVariantsTable.id,
            externalId: productVariantsTable.externalId,
          })
          .from(productVariantsTable)
          .where(inArray(productVariantsTable.id, variantIds))
      : [];

  const variantExternalIdMap = new Map(
    variants.map((v) => [v.id, v.externalId]),
  );

  // Build result with catalog variant IDs
  const result: Array<{
    orderItemId: string;
    productId: string;
    productVariantId: string | null;
    catalogVariantId: number;
    quantity: number;
    name: string;
    priceCents: number;
  }> = [];

  for (const item of items) {
    if (!item.productId || !printfulProductIds.has(item.productId)) continue;

    // Get catalog_variant_id from variant's externalId, or fall back to product's externalId
    let catalogVariantId: number | null = null;

    if (item.productVariantId) {
      const variantExternalId = variantExternalIdMap.get(item.productVariantId);
      if (variantExternalId) {
        catalogVariantId = Number.parseInt(variantExternalId, 10);
      }
    }

    // If no variant or variant doesn't have external ID, try to get from product
    // (This is a fallback - ideally all Printful products have variant-level IDs)
    if (!catalogVariantId || isNaN(catalogVariantId)) {
      const product = products.find((p) => p.id === item.productId);
      if (product?.externalId) {
        // Note: This is the catalog_product_id, not variant.
        // For Printful orders, we need catalog_variant_id.
        // Skip items without proper variant IDs
        console.warn(
          `Order item ${item.id} has Printful product but no variant with catalog_variant_id`,
        );
        continue;
      }
    }

    if (!catalogVariantId || isNaN(catalogVariantId)) {
      console.warn(
        `Skipping order item ${item.id}: no valid catalog_variant_id`,
      );
      continue;
    }

    result.push({
      orderItemId: item.id,
      productId: item.productId,
      productVariantId: item.productVariantId,
      catalogVariantId,
      quantity: item.quantity,
      name: item.name,
      priceCents: item.priceCents,
    });
  }

  return result;
}

/**
 * Create and confirm a Printful order for a paid order.
 * Called after payment is confirmed.
 */
export async function createAndConfirmPrintfulOrder(
  orderId: string,
): Promise<PrintfulOrderResult> {
  // Check if Printful is configured
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { success: false, error: "Printful not configured" };
  }

  // Get the order
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Check if already sent to Printful
  if (order.printfulOrderId) {
    return {
      success: true,
      printfulOrderId: Number.parseInt(order.printfulOrderId, 10),
      error: "Order already sent to Printful",
    };
  }

  // Get Printful items
  const printfulItems = await getPrintfulOrderItems(orderId);

  if (printfulItems.length === 0) {
    // No Printful items - this is not an error, just nothing to do
    return { success: true };
  }

  // Build recipient from order shipping fields
  const recipient: PrintfulRecipient = {
    name: order.shippingName || undefined,
    address1: order.shippingAddress1 || "",
    address2: order.shippingAddress2 || undefined,
    city: order.shippingCity || undefined,
    state_code: order.shippingStateCode || undefined,
    country_code: order.shippingCountryCode || "",
    zip: order.shippingZip || undefined,
    phone: order.shippingPhone || undefined,
    email: order.email,
  };

  // Validate required fields
  if (!recipient.address1 || !recipient.country_code) {
    return {
      success: false,
      error: "Missing required shipping address for Printful order",
    };
  }

  // US, CA, AU require state_code
  if (
    ["US", "CA", "AU"].includes(recipient.country_code) &&
    !recipient.state_code
  ) {
    return {
      success: false,
      error: `State code required for ${recipient.country_code} orders`,
    };
  }

  // Build order items
  const orderItems: PrintfulOrderItem[] = printfulItems.map((item) => ({
    source: "catalog" as const,
    catalog_variant_id: item.catalogVariantId,
    quantity: item.quantity,
    external_id: item.orderItemId,
    retail_price: (item.priceCents / 100).toFixed(2),
    name: item.name,
  }));

  // Build request
  const createRequest: PrintfulCreateOrderRequest = {
    external_id: orderId,
    shipping: order.shippingMethod || "STANDARD",
    recipient,
    order_items: orderItems,
    retail_costs: {
      currency: "USD",
      shipping: ((order.shippingFeeCents || 0) / 100).toFixed(2),
      tax: ((order.taxCents || 0) / 100).toFixed(2),
    },
  };

  try {
    // Create draft order
    console.log(`Creating Printful order for order ${orderId}...`);
    const createResponse = await createPrintfulOrder(createRequest);
    const printfulOrderId = createResponse.data.id;

    console.log(`Printful draft order created: ${printfulOrderId}`);

    // Wait a moment for cost calculation (Printful calculates async)
    // In production, you might want to poll or use webhooks
    await new Promise((r) => setTimeout(r, 2000));

    // Confirm the order (submit for fulfillment)
    console.log(`Confirming Printful order ${printfulOrderId}...`);
    const confirmResponse = await confirmPrintfulOrder(printfulOrderId);

    if (
      confirmResponse.data.status === "pending" ||
      confirmResponse.data.status === "draft"
    ) {
      // Order is being processed
      console.log(
        `Printful order ${printfulOrderId} confirmed, status: ${confirmResponse.data.status}`,
      );
    }

    // Update our order with Printful order ID
    await db
      .update(ordersTable)
      .set({
        printfulOrderId: String(printfulOrderId),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));

    return {
      success: true,
      printfulOrderId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Printful error";
    console.error(`Failed to create Printful order for ${orderId}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cancel a Printful order.
 * Called when an order is refunded/cancelled before shipping.
 *
 * Note: Printful orders can only be cancelled in draft or failed state.
 * Once in process, cancellation may not be possible.
 */
export async function cancelPrintfulOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { success: false, error: "Printful not configured" };
  }

  // Get the order
  const [order] = await db
    .select({ printfulOrderId: ordersTable.printfulOrderId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order?.printfulOrderId) {
    // No Printful order to cancel
    return { success: true };
  }

  try {
    // Delete the Printful order
    const PRINTFUL_V2 = "https://api.printful.com/v2";
    const token = process.env.PRINTFUL_API_TOKEN?.trim();
    if (!token) {
      return { success: false, error: "PRINTFUL_API_TOKEN not set" };
    }

    const res = await fetch(`${PRINTFUL_V2}/orders/${order.printfulOrderId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 204) {
      // Successfully deleted
      console.log(`Printful order ${order.printfulOrderId} cancelled`);

      // Clear the Printful order ID from our order
      await db
        .update(ordersTable)
        .set({
          printfulOrderId: null,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));

      return { success: true };
    }

    if (res.status === 409) {
      // Conflict - order cannot be cancelled (already in process)
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: "Printful order cannot be cancelled - may already be in process",
      };
    }

    if (!res.ok) {
      const body = await res.text();
      return {
        success: false,
        error: `Printful API error: ${res.status} ${body}`,
      };
    }

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error cancelling Printful order";
    console.error(`Failed to cancel Printful order:`, message);
    return { success: false, error: message };
  }
}

/**
 * Update our order status based on Printful webhook event.
 */
export async function updateOrderFromPrintfulWebhook(
  printfulOrderId: string,
  event: {
    type: string;
    data: {
      order?: { status?: string };
      shipment?: {
        id?: number;
        status?: string;
        tracking_number?: string;
        tracking_url?: string;
      };
    };
  },
): Promise<{ success: boolean; error?: string }> {
  // Find our order by Printful order ID
  const [order] = await db
    .select({
      id: ordersTable.id,
      fulfillmentStatus: ordersTable.fulfillmentStatus,
    })
    .from(ordersTable)
    .where(eq(ordersTable.printfulOrderId, printfulOrderId))
    .limit(1);

  if (!order) {
    console.warn(`No order found for Printful order ${printfulOrderId}`);
    return { success: false, error: "Order not found" };
  }

  const updates: Partial<typeof ordersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  // Map Printful events to our fulfillment status
  switch (event.type) {
    case "shipment_sent":
      // Check if this is partial or full shipment
      // For now, mark as fulfilled - could be enhanced with shipment tracking
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
      break;

    case "shipment_delivered":
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
      break;

    case "order_updated":
      // Order updated - check status
      const orderStatus = event.data.order?.status;
      if (orderStatus === "inprocess") {
        // Being fulfilled
        if (order.fulfillmentStatus !== "fulfilled") {
          updates.fulfillmentStatus = "partially_fulfilled";
        }
      } else if (orderStatus === "partial") {
        updates.fulfillmentStatus = "partially_fulfilled";
      } else if (orderStatus === "fulfilled") {
        updates.fulfillmentStatus = "fulfilled";
        updates.status = "fulfilled";
      }
      break;

    case "order_failed":
      // Order failed at Printful
      updates.fulfillmentStatus = "on_hold";
      break;

    case "order_canceled":
      // Printful cancelled the order
      updates.fulfillmentStatus = "unfulfilled";
      // Note: Don't change payment status - that's a separate concern
      break;

    case "shipment_returned":
      // Package returned
      updates.fulfillmentStatus = "on_hold";
      break;

    default:
      // Unknown event type - log but don't fail
      console.log(`Unhandled Printful webhook event: ${event.type}`);
      return { success: true };
  }

  if (Object.keys(updates).length > 1) {
    // More than just updatedAt
    await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, order.id));
    console.log(
      `Updated order ${order.id} from Printful webhook: ${event.type}`,
    );

    // Notify Telegram user (vendor → our backend → Telegram; never vendor → Telegram directly)
    const shipment = event.data.shipment;
    const trackingNumber = shipment?.tracking_number;
    const trackingUrl = shipment?.tracking_url ?? undefined;
    if (
      updates.fulfillmentStatus === "fulfilled" ||
      updates.status === "fulfilled"
    ) {
      void onOrderStatusUpdate(order.id, "order_shipped", {
        trackingNumber: trackingNumber ?? undefined,
        trackingUrl,
      });
    } else if (updates.fulfillmentStatus === "on_hold") {
      void onOrderStatusUpdate(order.id, "order_on_hold");
    } else if (
      updates.fulfillmentStatus === "unfulfilled" &&
      event.type === "order_canceled"
    ) {
      void onOrderStatusUpdate(order.id, "order_cancelled");
    }
  }

  return { success: true };
}
