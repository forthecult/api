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
import { onOrderStatusUpdate } from "~/lib/create-user-notification";
import {
  confirmPrintfulOrder,
  createPrintfulOrder,
  deletePrintfulOrder,
  fetchOrderShipments,
  getPrintfulIfConfigured,
  getPrintfulOrder,
  type PrintfulCreateOrderRequest,
  type PrintfulOrderCosts,
  type PrintfulOrderItem,
  type PrintfulRecipient,
  type PrintfulShipment,
} from "~/lib/printful";

export interface PrintfulOrderResult {
  error?: string;
  printfulOrderId?: number;
  success: boolean;
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
): Promise<{ error?: string; success: boolean }> {
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return { error: "Printful not configured", success: false };
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

  const storeId = (() => {
    const raw = process.env.PRINTFUL_STORE_ID?.trim();
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  })();

  try {
    const result = await deletePrintfulOrder(
      Number.parseInt(order.printfulOrderId, 10),
      storeId,
    );

    if (result.success) {
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

    return { error: result.error, success: false };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error cancelling Printful order";
    console.error(`Failed to cancel Printful order:`, message);
    return { error: message, success: false };
  }
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
    return { error: "Printful not configured", success: false };
  }

  // Get the order
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) {
    return { error: "Order not found", success: false };
  }

  // Check if already sent to Printful
  if (order.printfulOrderId) {
    return {
      error: "Order already sent to Printful",
      printfulOrderId: Number.parseInt(order.printfulOrderId, 10),
      success: true,
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
    address1: order.shippingAddress1 || "",
    address2: order.shippingAddress2 || undefined,
    city: order.shippingCity || undefined,
    country_code: order.shippingCountryCode || "",
    email: order.email,
    name: order.shippingName || undefined,
    phone: order.shippingPhone || undefined,
    state_code: order.shippingStateCode || undefined,
    zip: order.shippingZip || undefined,
  };

  // Validate required fields
  if (!recipient.address1 || !recipient.country_code) {
    return {
      error: "Missing required shipping address for Printful order",
      success: false,
    };
  }

  // US, CA, AU require state_code
  if (
    ["AU", "CA", "US"].includes(recipient.country_code) &&
    !recipient.state_code
  ) {
    return {
      error: `State code required for ${recipient.country_code} orders`,
      success: false,
    };
  }

  // Build order items
  const orderItems: PrintfulOrderItem[] = printfulItems.map((item) => ({
    catalog_variant_id: item.catalogVariantId,
    external_id: item.orderItemId,
    name: item.name,
    quantity: item.quantity,
    retail_price: (item.priceCents / 100).toFixed(2),
    source: "catalog" as const,
  }));

  // Build request
  const createRequest: PrintfulCreateOrderRequest = {
    external_id: orderId,
    order_items: orderItems,
    recipient,
    retail_costs: {
      currency: "USD",
      shipping: ((order.shippingFeeCents || 0) / 100).toFixed(2),
      tax: ((order.taxCents || 0) / 100).toFixed(2),
    },
    shipping: order.shippingMethod || "STANDARD",
  };

  const storeId = (() => {
    const raw = process.env.PRINTFUL_STORE_ID?.trim();
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  })();

  try {
    // Create draft order
    console.log(`Creating Printful order for order ${orderId}...`);
    const createResponse = await createPrintfulOrder(createRequest, storeId);
    const printfulOrderId = createResponse.data.id;

    console.log(`Printful draft order created: ${printfulOrderId}`);

    // Poll until cost calculation completes (Printful calculates async)
    const MAX_POLLS = 10;
    const POLL_INTERVAL_MS = 1500;
    for (let i = 0; i < MAX_POLLS; i++) {
      const orderCheck = await getPrintfulOrder(printfulOrderId, storeId);
      if (orderCheck.data.costs?.calculation_status === "completed") {
        console.log(
          `Printful order ${printfulOrderId} cost calculation completed`,
        );
        break;
      }
      if (orderCheck.data.costs?.calculation_status === "failed") {
        console.warn(
          `Printful order ${printfulOrderId} cost calculation failed, confirming anyway`,
        );
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Confirm the order (submit for fulfillment)
    console.log(`Confirming Printful order ${printfulOrderId}...`);
    const confirmResponse = await confirmPrintfulOrder(
      printfulOrderId,
      storeId,
    );

    console.log(
      `Printful order ${printfulOrderId} confirmed, status: ${confirmResponse.data.status}`,
    );

    // Extract Printful wholesale costs (admin-only data)
    const costs = confirmResponse.data.costs;
    const printfulCostUpdates: Record<string, unknown> = {};
    if (costs) {
      if (costs.total != null) {
        printfulCostUpdates.printfulCostTotalCents = Math.round(
          Number.parseFloat(costs.total) * 100,
        );
      }
      if (costs.shipping != null) {
        printfulCostUpdates.printfulCostShippingCents = Math.round(
          Number.parseFloat(costs.shipping) * 100,
        );
      }
      const taxVal = costs.tax ?? costs.vat;
      if (taxVal != null) {
        printfulCostUpdates.printfulCostTaxCents = Math.round(
          Number.parseFloat(taxVal) * 100,
        );
      }
    }

    // Update our order with Printful order ID and costs
    await db
      .update(ordersTable)
      .set({
        printfulOrderId: String(printfulOrderId),
        ...printfulCostUpdates,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));

    return {
      printfulOrderId,
      success: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Printful error";
    console.error(`Failed to create Printful order for ${orderId}:`, message);
    return {
      error: message,
      success: false,
    };
  }
}

/**
 * Get Printful items from an order with their catalog variant IDs
 */
export async function getPrintfulOrderItems(orderId: string): Promise<
  {
    catalogVariantId: number;
    name: string;
    orderItemId: string;
    priceCents: number;
    productId: string;
    productVariantId: null | string;
    quantity: number;
  }[]
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
      externalId: productsTable.externalId,
      id: productsTable.id,
      source: productsTable.source,
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
            externalId: productVariantsTable.externalId,
            id: productVariantsTable.id,
          })
          .from(productVariantsTable)
          .where(inArray(productVariantsTable.id, variantIds))
      : [];

  const variantExternalIdMap = new Map(
    variants.map((v) => [v.id, v.externalId]),
  );

  // Build result with catalog variant IDs
  const result: {
    catalogVariantId: number;
    name: string;
    orderItemId: string;
    priceCents: number;
    productId: string;
    productVariantId: null | string;
    quantity: number;
  }[] = [];

  for (const item of items) {
    if (!item.productId || !printfulProductIds.has(item.productId)) continue;

    // Get catalog_variant_id from variant's externalId, or fall back to product's externalId
    let catalogVariantId: null | number = null;

    if (item.productVariantId) {
      const variantExternalId = variantExternalIdMap.get(item.productVariantId);
      if (variantExternalId) {
        catalogVariantId = Number.parseInt(variantExternalId, 10);
      }
    }

    // If no variant or variant doesn't have external ID, try to get from product
    // (This is a fallback - ideally all Printful products have variant-level IDs)
    if (!catalogVariantId || Number.isNaN(catalogVariantId)) {
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

    if (!catalogVariantId || Number.isNaN(catalogVariantId)) {
      console.warn(
        `Skipping order item ${item.id}: no valid catalog_variant_id`,
      );
      continue;
    }

    result.push({
      catalogVariantId,
      name: item.name,
      orderItemId: item.id,
      priceCents: item.priceCents,
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
    });
  }

  return result;
}

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
 * Fetch and persist shipment tracking data from Printful for an order.
 * Call this on-demand (e.g. admin viewing order details) to backfill tracking
 * info that may have been missed by webhooks.
 */
export async function syncPrintfulShipmentTracking(orderId: string): Promise<{
  error?: string;
  shipments?: PrintfulShipment[];
  success: boolean;
}> {
  const pf = getPrintfulIfConfigured();
  if (!pf) return { error: "Printful not configured", success: false };

  const [order] = await db
    .select({
      id: ordersTable.id,
      printfulOrderId: ordersTable.printfulOrderId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order?.printfulOrderId) {
    return { error: "No Printful order linked", success: false };
  }

  const storeId = (() => {
    const raw = process.env.PRINTFUL_STORE_ID?.trim();
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? undefined : n;
  })();

  try {
    const pfOrderId = Number.parseInt(order.printfulOrderId, 10);
    const shipmentsRes = await fetchOrderShipments(pfOrderId, storeId);
    const shipments = shipmentsRes.data;

    if (shipments.length === 0) {
      return { shipments: [], success: true };
    }

    // Use the latest (most recent) shipment for tracking info
    const latest = shipments[shipments.length - 1]!;

    const updates: Partial<typeof ordersTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (latest.tracking_number) updates.trackingNumber = latest.tracking_number;
    if (latest.tracking_url) updates.trackingUrl = latest.tracking_url;
    if (latest.carrier) updates.trackingCarrier = latest.carrier;
    if (latest.shipped_at) updates.shippedAt = new Date(latest.shipped_at);
    if (latest.delivered_at)
      updates.deliveredAt = new Date(latest.delivered_at);
    if (latest.estimated_delivery?.from_date) {
      updates.estimatedDeliveryFrom = latest.estimated_delivery.from_date;
    }
    if (latest.estimated_delivery?.to_date) {
      updates.estimatedDeliveryTo = latest.estimated_delivery.to_date;
    }
    if (latest.tracking_events && latest.tracking_events.length > 0) {
      updates.trackingEventsJson = JSON.stringify(latest.tracking_events);
    }

    await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, orderId));

    return { shipments, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message, success: false };
  }
}

/**
 * Update our order status based on Printful webhook event.
 * Persists tracking data (tracking number, URL, carrier, events, estimated delivery)
 * and Printful wholesale costs to the database.
 */
export async function updateOrderFromPrintfulWebhook(
  printfulOrderId: string,
  event: {
    data: {
      order?: { costs?: Partial<PrintfulOrderCosts>; status?: string };
      shipment?: {
        carrier?: string;
        delivered_at?: string;
        delivery_status?: string;
        estimated_delivery?: {
          from_date?: string;
          to_date?: string;
        };
        id?: number;
        shipped_at?: string;
        status?: string;
        tracking_events?: { description: string; triggered_at: string }[];
        tracking_number?: string;
        tracking_url?: string;
      };
    };
    type: string;
  },
): Promise<{ error?: string; success: boolean }> {
  // Find our order by Printful order ID
  const [order] = await db
    .select({
      fulfillmentStatus: ordersTable.fulfillmentStatus,
      id: ordersTable.id,
    })
    .from(ordersTable)
    .where(eq(ordersTable.printfulOrderId, printfulOrderId))
    .limit(1);

  if (!order) {
    console.warn(`No order found for Printful order ${printfulOrderId}`);
    return { error: "Order not found", success: false };
  }

  const updates: Partial<typeof ordersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  // Persist shipment tracking data whenever present
  const shipment = event.data.shipment;
  if (shipment) {
    if (shipment.tracking_number)
      updates.trackingNumber = shipment.tracking_number;
    if (shipment.tracking_url) updates.trackingUrl = shipment.tracking_url;
    if (shipment.carrier) updates.trackingCarrier = shipment.carrier;
    if (shipment.shipped_at) updates.shippedAt = new Date(shipment.shipped_at);
    if (shipment.delivered_at)
      updates.deliveredAt = new Date(shipment.delivered_at);
    if (shipment.estimated_delivery?.from_date) {
      updates.estimatedDeliveryFrom = shipment.estimated_delivery.from_date;
    }
    if (shipment.estimated_delivery?.to_date) {
      updates.estimatedDeliveryTo = shipment.estimated_delivery.to_date;
    }
    if (shipment.tracking_events && shipment.tracking_events.length > 0) {
      updates.trackingEventsJson = JSON.stringify(shipment.tracking_events);
    }
  }

  // Persist Printful wholesale costs when available (admin-only)
  const orderCosts = event.data.order?.costs;
  if (orderCosts) {
    if (orderCosts.total != null) {
      updates.printfulCostTotalCents = Math.round(
        Number.parseFloat(orderCosts.total) * 100,
      );
    }
    if (orderCosts.shipping != null) {
      updates.printfulCostShippingCents = Math.round(
        Number.parseFloat(orderCosts.shipping) * 100,
      );
    }
    const taxVal = orderCosts.tax ?? orderCosts.vat;
    if (taxVal != null) {
      updates.printfulCostTaxCents = Math.round(
        Number.parseFloat(taxVal) * 100,
      );
    }
  }

  // Map Printful events to our fulfillment status
  // Note: Printful v1 API uses "package_shipped", v2 uses "shipment_sent"
  // We handle both for compatibility
  switch (event.type) {
    case "order_canceled":
      // Printful cancelled the order
      updates.fulfillmentStatus = "unfulfilled";
      // Note: Don't change payment status - that's a separate concern
      break;
    case "order_created":
      // Order created at Printful - mark as processing
      if (order.fulfillmentStatus === "unfulfilled") {
        updates.fulfillmentStatus = "partially_fulfilled";
      }
      break;

    case "order_failed":
      // Order failed at Printful
      updates.fulfillmentStatus = "on_hold";
      break;

    case "order_put_hold":

    case "order_put_hold_approval":
      // Order put on hold
      updates.fulfillmentStatus = "on_hold";
      break;

    case "order_refunded":
      // Printful-initiated refund
      updates.paymentStatus = "refunded";
      updates.status = "refunded";
      break;

    case "order_remove_hold":
      // Order removed from hold - back to processing
      if (order.fulfillmentStatus === "on_hold") {
        updates.fulfillmentStatus = "partially_fulfilled";
      }
      break;

    case "order_updated": {
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
    }

    case "package_returned":
    case "shipment_returned":
      // Package returned
      updates.fulfillmentStatus = "on_hold";
      break;

    case "package_shipped":

    case "shipment_sent":
      // Package/shipment has shipped
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
      break;

    case "shipment_canceled":
      // Individual shipment cancelled
      updates.fulfillmentStatus = "on_hold";
      break;
    case "shipment_delivered":
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
      if (shipment?.delivered_at) {
        updates.deliveredAt = new Date(shipment.delivered_at);
      } else {
        updates.deliveredAt = new Date();
      }
      break;

    case "shipment_out_of_stock":
      // Shipment out of stock - alert admin, set on hold
      updates.fulfillmentStatus = "on_hold";
      console.warn(
        `[Printful] Shipment out of stock for order ${order.id} (Printful order ${printfulOrderId})`,
      );
      break;
    case "shipment_put_hold":

    case "shipment_put_hold_approval":
      // Shipment put on hold - alert admin but DO NOT change store fulfillment status
      console.warn(
        `[Printful] Shipment hold for order ${order.id} (Printful order ${printfulOrderId}): ${event.type}`,
      );
      // Only persist tracking/cost updates, no status change
      break;

    case "shipment_remove_hold":
      // Shipment hold removed - log only (status unchanged per shipment_put_hold policy)
      console.log(`[Printful] Shipment hold removed for order ${order.id}`);
      break;

    default:
      // Unknown event type - log but don't fail
      console.log(`Unhandled Printful webhook event: ${event.type}`);
      // Still persist any tracking/cost data that was set above
      break;
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

    // Notify user of order status changes
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
    } else if (
      updates.fulfillmentStatus === "partially_fulfilled" &&
      event.type === "order_created"
    ) {
      void onOrderStatusUpdate(order.id, "order_processing");
    } else if (event.type === "order_refunded") {
      void onOrderStatusUpdate(order.id, "order_cancelled");
    }
  }

  return { success: true };
}
