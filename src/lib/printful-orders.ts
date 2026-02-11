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
  deletePrintfulOrder,
  getPrintfulIfConfigured,
  getPrintfulOrder,
  fetchOrderShipments,
  type PrintfulCreateOrderRequest,
  type PrintfulOrderItem,
  type PrintfulOrderCosts,
  type PrintfulRecipient,
  type PrintfulShipment,
} from "~/lib/printful";
import {
  onOrderStatusUpdate,
  type OrderStatusKind,
} from "~/lib/create-user-notification";

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
        console.log(`Printful order ${printfulOrderId} cost calculation completed`);
        break;
      }
      if (orderCheck.data.costs?.calculation_status === "failed") {
        console.warn(`Printful order ${printfulOrderId} cost calculation failed, confirming anyway`);
        break;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    // Confirm the order (submit for fulfillment)
    console.log(`Confirming Printful order ${printfulOrderId}...`);
    const confirmResponse = await confirmPrintfulOrder(printfulOrderId, storeId);

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

    return { success: false, error: result.error };
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
 * Persists tracking data (tracking number, URL, carrier, events, estimated delivery)
 * and Printful wholesale costs to the database.
 */
export async function updateOrderFromPrintfulWebhook(
  printfulOrderId: string,
  event: {
    type: string;
    data: {
      order?: { status?: string; costs?: Partial<PrintfulOrderCosts> };
      shipment?: {
        id?: number;
        status?: string;
        tracking_number?: string;
        tracking_url?: string;
        carrier?: string;
        shipped_at?: string;
        delivered_at?: string;
        delivery_status?: string;
        tracking_events?: Array<{ triggered_at: string; description: string }>;
        estimated_delivery?: {
          from_date?: string;
          to_date?: string;
        };
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

  // Persist shipment tracking data whenever present
  const shipment = event.data.shipment;
  if (shipment) {
    if (shipment.tracking_number) updates.trackingNumber = shipment.tracking_number;
    if (shipment.tracking_url) updates.trackingUrl = shipment.tracking_url;
    if (shipment.carrier) updates.trackingCarrier = shipment.carrier;
    if (shipment.shipped_at) updates.shippedAt = new Date(shipment.shipped_at);
    if (shipment.delivered_at) updates.deliveredAt = new Date(shipment.delivered_at);
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
      updates.printfulCostTotalCents = Math.round(Number.parseFloat(orderCosts.total) * 100);
    }
    if (orderCosts.shipping != null) {
      updates.printfulCostShippingCents = Math.round(Number.parseFloat(orderCosts.shipping) * 100);
    }
    const taxVal = orderCosts.tax ?? orderCosts.vat;
    if (taxVal != null) {
      updates.printfulCostTaxCents = Math.round(Number.parseFloat(taxVal) * 100);
    }
  }

  // Map Printful events to our fulfillment status
  // Note: Printful v1 API uses "package_shipped", v2 uses "shipment_sent"
  // We handle both for compatibility
  switch (event.type) {
    case "package_shipped":
    case "shipment_sent":
      // Package/shipment has shipped
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
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

    case "order_created":
      // Order created at Printful - mark as processing
      if (order.fulfillmentStatus === "unfulfilled") {
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

    case "order_failed":
      // Order failed at Printful
      updates.fulfillmentStatus = "on_hold";
      break;

    case "order_canceled":
      // Printful cancelled the order
      updates.fulfillmentStatus = "unfulfilled";
      // Note: Don't change payment status - that's a separate concern
      break;

    case "order_refunded":
      // Printful-initiated refund
      updates.paymentStatus = "refunded";
      updates.status = "refunded";
      break;

    case "package_returned":
    case "shipment_returned":
      // Package returned
      updates.fulfillmentStatus = "on_hold";
      break;

    case "shipment_out_of_stock":
      // Shipment out of stock - alert admin, set on hold
      updates.fulfillmentStatus = "on_hold";
      console.warn(`[Printful] Shipment out of stock for order ${order.id} (Printful order ${printfulOrderId})`);
      break;

    case "shipment_canceled":
      // Individual shipment cancelled
      updates.fulfillmentStatus = "on_hold";
      break;

    case "order_put_hold":
    case "order_put_hold_approval":
      // Order put on hold
      updates.fulfillmentStatus = "on_hold";
      break;

    case "shipment_put_hold":
    case "shipment_put_hold_approval":
      // Shipment put on hold - alert admin but DO NOT change store fulfillment status
      console.warn(`[Printful] Shipment hold for order ${order.id} (Printful order ${printfulOrderId}): ${event.type}`);
      // Only persist tracking/cost updates, no status change
      break;

    case "shipment_remove_hold":
      // Shipment hold removed - log only (status unchanged per shipment_put_hold policy)
      console.log(`[Printful] Shipment hold removed for order ${order.id}`);
      break;

    case "order_remove_hold":
      // Order removed from hold - back to processing
      if (order.fulfillmentStatus === "on_hold") {
        updates.fulfillmentStatus = "partially_fulfilled";
      }
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

/**
 * Fetch and persist shipment tracking data from Printful for an order.
 * Call this on-demand (e.g. admin viewing order details) to backfill tracking
 * info that may have been missed by webhooks.
 */
export async function syncPrintfulShipmentTracking(
  orderId: string,
): Promise<{ success: boolean; shipments?: PrintfulShipment[]; error?: string }> {
  const pf = getPrintfulIfConfigured();
  if (!pf) return { success: false, error: "Printful not configured" };

  const [order] = await db
    .select({
      id: ordersTable.id,
      printfulOrderId: ordersTable.printfulOrderId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order?.printfulOrderId) {
    return { success: false, error: "No Printful order linked" };
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
      return { success: true, shipments: [] };
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
    if (latest.delivered_at) updates.deliveredAt = new Date(latest.delivered_at);
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

    return { success: true, shipments };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
