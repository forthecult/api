/**
 * Printify Order Management Service
 *
 * Handles creating, confirming, and canceling orders with Printify.
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
  createPrintifyOrder,
  createPrintifyExpressOrder,
  sendPrintifyOrderToProduction,
  cancelPrintifyOrder as cancelPrintifyOrderApi,
  calculatePrintifyOrderShipping,
  getPrintifyIfConfigured,
  type PrintifyCreateOrderRequest,
  type PrintifyOrderLineItem,
  type PrintifyOrderRecipient,
  type PrintifyShippingMethod,
} from "~/lib/printify";
import {
  onOrderStatusUpdate,
  type OrderStatusKind,
} from "~/lib/create-user-notification";

export type PrintifyOrderResult = {
  success: boolean;
  printifyOrderId?: string;
  error?: string;
};

/**
 * Check if any order items are Printify products
 */
export async function hasPrintifyItems(orderId: string): Promise<boolean> {
  const items = await db
    .select({
      productId: orderItemsTable.productId,
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

  return products.some((p) => p.source === "printify");
}

/**
 * Get Printify items from an order with their Printify product/variant IDs
 *
 * For Printify, we need:
 * - product_id: The Printify product ID (stored in product.externalId)
 * - variant_id: The Printify variant ID (stored in productVariant.externalId)
 */
export async function getPrintifyOrderItems(orderId: string): Promise<
  Array<{
    orderItemId: string;
    productId: string;
    productVariantId: string | null;
    printifyProductId: string;
    printifyVariantId: number;
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
      printifyProductId: productsTable.printifyProductId,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  // Use printifyProductId (the actual Printify product ID) — NOT externalId (which is the blueprint_id).
  // Printify's order API requires the product ID, not the blueprint ID.
  const printifyProducts = new Map(
    products
      .filter((p) => p.source === "printify" && p.printifyProductId)
      .map((p) => [p.id, p.printifyProductId!]),
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

  // Build result with Printify IDs
  const result: Array<{
    orderItemId: string;
    productId: string;
    productVariantId: string | null;
    printifyProductId: string;
    printifyVariantId: number;
    quantity: number;
    name: string;
    priceCents: number;
  }> = [];

  for (const item of items) {
    if (!item.productId) continue;

    const printifyProductId = printifyProducts.get(item.productId);
    if (!printifyProductId) continue;

    // Get variant ID
    let printifyVariantId: number | null = null;
    if (item.productVariantId) {
      const variantExternalId = variantExternalIdMap.get(item.productVariantId);
      if (variantExternalId) {
        printifyVariantId = Number.parseInt(variantExternalId, 10);
      }
    }

    if (!printifyVariantId || isNaN(printifyVariantId)) {
      console.warn(
        `Skipping order item ${item.id}: Printify product without valid variant ID`,
      );
      continue;
    }

    result.push({
      orderItemId: item.id,
      productId: item.productId,
      productVariantId: item.productVariantId,
      printifyProductId,
      printifyVariantId,
      quantity: item.quantity,
      name: item.name,
      priceCents: item.priceCents,
    });
  }

  return result;
}

/**
 * Create and send a Printify order to production for a paid order.
 * Called after payment is confirmed.
 */
export async function createAndConfirmPrintifyOrder(
  orderId: string,
): Promise<PrintifyOrderResult> {
  // Check if Printify is configured
  const config = getPrintifyIfConfigured();
  if (!config) {
    return { success: false, error: "Printify not configured" };
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

  // Check if already sent to Printify
  if (order.printifyOrderId) {
    return {
      success: true,
      printifyOrderId: order.printifyOrderId,
      error: "Order already sent to Printify",
    };
  }

  // Get Printify items
  const printifyItems = await getPrintifyOrderItems(orderId);

  if (printifyItems.length === 0) {
    // No Printify items - this is not an error, just nothing to do
    return { success: true };
  }

  // Parse shipping name into first/last
  const nameParts = (order.shippingName || "Customer").split(" ");
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "";

  // Build recipient from order shipping fields
  const recipient: PrintifyOrderRecipient = {
    first_name: firstName,
    last_name: lastName,
    email: order.email,
    phone: order.shippingPhone || undefined,
    country: order.shippingCountryCode || "",
    region: order.shippingStateCode || undefined,
    address1: order.shippingAddress1 || "",
    address2: order.shippingAddress2 || undefined,
    city: order.shippingCity || "",
    zip: order.shippingZip || "",
  };

  // Validate required fields
  if (
    !recipient.address1 ||
    !recipient.country ||
    !recipient.city ||
    !recipient.zip
  ) {
    return {
      success: false,
      error: "Missing required shipping address for Printify order",
    };
  }

  // Build order line items
  const lineItems: PrintifyOrderLineItem[] = printifyItems.map((item) => ({
    product_id: item.printifyProductId,
    variant_id: item.printifyVariantId,
    quantity: item.quantity,
  }));

  // Determine shipping method (1=Standard, 2=Priority, 3=Printify Express, 4=Economy)
  const shippingMethodStr = (order.shippingMethod ?? "").toLowerCase();
  let shippingMethod: PrintifyShippingMethod = 1; // Default to standard
  let isPrintifyExpress = false;
  let isEconomyShipping = false;

  if (
    shippingMethodStr.includes("printify_express") ||
    shippingMethodStr === "printify-express"
  ) {
    shippingMethod = 3;
    isPrintifyExpress = true;
  } else if (
    shippingMethodStr.includes("express") ||
    shippingMethodStr.includes("priority")
  ) {
    shippingMethod = 2;
  } else if (shippingMethodStr.includes("economy")) {
    shippingMethod = 4;
    isEconomyShipping = true;
  }

  // Build request
  const createRequest: PrintifyCreateOrderRequest = {
    external_id: orderId,
    label: `Order ${orderId}`,
    line_items: lineItems,
    shipping_method: shippingMethod,
    is_printify_express: isPrintifyExpress || undefined,
    is_economy_shipping: isEconomyShipping || undefined,
    send_shipping_notification: true, // Printify sends email to customer
    address_to: recipient,
  };

  try {
    // Create the order — use Express endpoint if Printify Express shipping was selected
    console.log(
      `Creating Printify order for order ${orderId} (method: ${shippingMethod}, express: ${isPrintifyExpress})...`,
    );
    const createResponse = isPrintifyExpress
      ? await createPrintifyExpressOrder(config.shopId, createRequest)
      : await createPrintifyOrder(config.shopId, createRequest);
    const printifyOrderId = createResponse.id;

    console.log(`Printify order created: ${printifyOrderId}`);

    // Send to production (confirm the order)
    console.log(`Sending Printify order ${printifyOrderId} to production...`);
    await sendPrintifyOrderToProduction(config.shopId, printifyOrderId);

    console.log(`Printify order ${printifyOrderId} sent to production`);

    // Update our order with Printify order ID and store fulfillment costs
    await db
      .update(ordersTable)
      .set({
        printifyOrderId,
        // Store Printify costs (wholesale cost to us) — admin-only, not shown to customers
        printifyCostTotalCents: createResponse.total_price ?? null,
        printifyCostShippingCents: createResponse.total_shipping ?? null,
        printifyCostTaxCents: createResponse.total_tax ?? null,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));

    return {
      success: true,
      printifyOrderId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Printify error";
    console.error(`Failed to create Printify order for ${orderId}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cancel a Printify order.
 * Called when an order is refunded/cancelled before shipping.
 *
 * Note: Printify orders can only be cancelled before they go into production.
 */
export async function cancelPrintifyOrder(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getPrintifyIfConfigured();
  if (!config) {
    return { success: false, error: "Printify not configured" };
  }

  // Get the order
  const [order] = await db
    .select({ printifyOrderId: ordersTable.printifyOrderId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order?.printifyOrderId) {
    // No Printify order to cancel
    return { success: true };
  }

  try {
    const result = await cancelPrintifyOrderApi(
      config.shopId,
      order.printifyOrderId,
    );

    if (result.success) {
      console.log(`Printify order ${order.printifyOrderId} cancelled`);

      // Clear the Printify order ID from our order
      await db
        .update(ordersTable)
        .set({
          printifyOrderId: null,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error cancelling Printify order";
    console.error(`Failed to cancel Printify order:`, message);
    return { success: false, error: message };
  }
}

/**
 * Update our order status based on Printify webhook event.
 */
export async function updateOrderFromPrintifyWebhook(
  printifyOrderId: string,
  event: {
    type: string;
    data: {
      status?: string;
      shipment?: {
        carrier?: string;
        number?: string;
        url?: string;
        delivered_at?: string | null;
      };
    };
  },
): Promise<{ success: boolean; error?: string }> {
  // Find our order by Printify order ID
  const [order] = await db
    .select({
      id: ordersTable.id,
      fulfillmentStatus: ordersTable.fulfillmentStatus,
    })
    .from(ordersTable)
    .where(eq(ordersTable.printifyOrderId, printifyOrderId))
    .limit(1);

  if (!order) {
    console.warn(`No order found for Printify order ${printifyOrderId}`);
    return { success: false, error: "Order not found" };
  }

  const updates: Partial<typeof ordersTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  // Map Printify events to our fulfillment status
  switch (event.type) {
    case "order:sent-to-production":
      // Order is being produced
      if (order.fulfillmentStatus !== "fulfilled") {
        updates.fulfillmentStatus = "partially_fulfilled";
      }
      break;

    case "order:shipment:created": {
      // Shipment created - store tracking data and mark as shipped
      updates.fulfillmentStatus = "partially_fulfilled";
      const shipment = event.data.shipment;
      if (shipment) {
        if (shipment.carrier) updates.trackingCarrier = shipment.carrier;
        if (shipment.number) updates.trackingNumber = shipment.number;
        if (shipment.url) updates.trackingUrl = shipment.url;
        updates.shippedAt = new Date();
      }
      break;
    }

    case "order:shipment:delivered": {
      // Delivered - store delivery timestamp and tracking data
      updates.fulfillmentStatus = "fulfilled";
      updates.status = "fulfilled";
      updates.deliveredAt = new Date();
      const deliveryShipment = event.data.shipment;
      if (deliveryShipment) {
        if (deliveryShipment.carrier)
          updates.trackingCarrier = deliveryShipment.carrier;
        if (deliveryShipment.number)
          updates.trackingNumber = deliveryShipment.number;
        if (deliveryShipment.url) updates.trackingUrl = deliveryShipment.url;
        if (deliveryShipment.delivered_at) {
          updates.deliveredAt = new Date(deliveryShipment.delivered_at);
        }
      }
      break;
    }

    case "order:updated": {
      // Check status field
      const status = event.data.status;
      if (status === "shipped" || status === "delivered") {
        updates.fulfillmentStatus = "fulfilled";
        updates.status = "fulfilled";
        if (status === "delivered") {
          updates.deliveredAt = new Date();
        }
      } else if (status === "in-production" || status === "shipping") {
        if (order.fulfillmentStatus !== "fulfilled") {
          updates.fulfillmentStatus = "partially_fulfilled";
        }
      } else if (status === "canceled") {
        updates.fulfillmentStatus = "unfulfilled";
      } else if (status === "on-hold") {
        updates.fulfillmentStatus = "on_hold";
      }
      // Store tracking data if present in any order:updated event
      const updatedShipment = event.data.shipment;
      if (updatedShipment) {
        if (updatedShipment.carrier)
          updates.trackingCarrier = updatedShipment.carrier;
        if (updatedShipment.number)
          updates.trackingNumber = updatedShipment.number;
        if (updatedShipment.url) updates.trackingUrl = updatedShipment.url;
      }
      break;
    }

    default:
      // Unknown event type - log but don't fail
      console.log(`Unhandled Printify webhook event: ${event.type}`);
      return { success: true };
  }

  if (Object.keys(updates).length > 1) {
    // More than just updatedAt
    await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, order.id));
    console.log(
      `Updated order ${order.id} from Printify webhook: ${event.type}`,
    );

    // Notify user of order status changes
    const shipment = event.data.shipment;
    const trackingNumber = shipment?.number;
    const trackingUrl = shipment?.url ?? undefined;
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
      event.type !== "order:shipment:delivered"
    ) {
      const isCanceled =
        event.type === "order:updated" && event.data.status === "canceled";
      if (isCanceled) {
        void onOrderStatusUpdate(order.id, "order_cancelled");
      }
    } else if (
      updates.fulfillmentStatus === "partially_fulfilled" &&
      event.type === "order:sent-to-production"
    ) {
      void onOrderStatusUpdate(order.id, "order_processing");
    }
  }

  return { success: true };
}

// ============================================================================
// Shipping Calculation via Printify Orders API
// ============================================================================

export type PrintifyShippingOption = {
  method: string; // "standard" | "express" | "priority" | "printify_express" | "economy"
  label: string;
  costCents: number;
  printifyMethodId: PrintifyShippingMethod;
};

/**
 * Calculate shipping options for Printify items using POST /orders/shipping.json.
 *
 * This is more accurate than catalog-based calculation because it uses the actual
 * order data (products, variants, quantities, destination) rather than generic
 * blueprint/provider profiles.
 *
 * Returns multiple shipping options (standard, express, economy, etc.) when available.
 */
export async function calculatePrintifyShippingOptions(
  items: Array<{
    printifyProductId: string;
    printifyVariantId: number;
    quantity: number;
  }>,
  address: {
    country: string;
    region?: string;
    zip?: string;
    city?: string;
  },
): Promise<{ options: PrintifyShippingOption[]; error?: string }> {
  const config = getPrintifyIfConfigured();
  if (!config) {
    return { options: [], error: "Printify not configured" };
  }

  const lineItems = items.map((item) => ({
    product_id: item.printifyProductId,
    variant_id: item.printifyVariantId,
    quantity: item.quantity,
  }));

  try {
    const result = await calculatePrintifyOrderShipping(config.shopId, {
      line_items: lineItems,
      address_to: address,
    });

    const options: PrintifyShippingOption[] = [];

    if (typeof result.standard === "number" && result.standard >= 0) {
      options.push({
        method: "standard",
        label: "Standard Shipping",
        costCents: result.standard,
        printifyMethodId: 1,
      });
    }
    if (typeof result.express === "number" && result.express > 0) {
      options.push({
        method: "express",
        label: "Express Shipping",
        costCents: result.express,
        printifyMethodId: 2,
      });
    }
    if (typeof result.priority === "number" && result.priority > 0) {
      options.push({
        method: "priority",
        label: "Priority Shipping",
        costCents: result.priority,
        printifyMethodId: 2,
      });
    }
    if (
      typeof result.printify_express === "number" &&
      result.printify_express > 0
    ) {
      options.push({
        method: "printify_express",
        label: "Printify Express (2-5 days)",
        costCents: result.printify_express,
        printifyMethodId: 3,
      });
    }
    if (typeof result.economy === "number" && result.economy >= 0) {
      options.push({
        method: "economy",
        label: "Economy Shipping",
        costCents: result.economy,
        printifyMethodId: 4,
      });
    }

    return { options };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Printify order shipping calculation failed:", message);
    return { options: [], error: message };
  }
}
