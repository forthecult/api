import { eq, inArray } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import crypto, { createHmac } from "node:crypto";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";
import { updateOrderFromPrintfulWebhook } from "~/lib/printful-orders";
import {
  handleProductDeleted,
  handleProductSynced,
  handleProductUpdated,
} from "~/lib/printful-sync";

// Also support GET for webhook URL verification (if Printful sends verification requests)
export async function GET() {
  return NextResponse.json({
    message: "Printful webhook endpoint",
    status: "ok",
  });
}

/**
 * POST /api/webhooks/printful
 *
 * Handles Printful webhook events (order, product sync, catalog, shipment).
 * Webhook signature verification using HMAC-SHA256 (header x-pf-webhook-signature).
 *
 * In production, PRINTFUL_WEBHOOK_SECRET is required; unverified requests are rejected.
 * Set the same hex secret in Printful's webhook settings and in this env var.
 *
 * Supported events:
 * - Product sync: product_synced, product_updated, product_deleted
 * - Order lifecycle: order_created, order_updated, order_failed, order_canceled, order_refunded,
 *   order_put_hold, order_put_hold_approval, order_remove_hold
 * - Shipment: shipment_sent, shipment_delivered, shipment_returned,
 *   shipment_out_of_stock, shipment_canceled, shipment_put_hold,
 *   shipment_put_hold_approval, shipment_remove_hold
 * - Legacy (v1 compat): package_shipped, package_returned, stock_updated
 * - Catalog (v2): catalog_stock_updated, catalog_price_changed
 * - Mockup: mockup_task_finished
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secretKey = process.env.PRINTFUL_WEBHOOK_SECRET?.trim();
    const isProduction = process.env.NODE_ENV === "production";

    // In production, require secret to be set so we never accept unverified webhooks
    if (isProduction && !secretKey) {
      console.warn(
        "Printful webhook: PRINTFUL_WEBHOOK_SECRET required in production",
      );
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 503 },
      );
    }

    if (secretKey) {
      const signature = request.headers.get("x-pf-webhook-signature");
      if (!signature) {
        console.warn("Printful webhook: missing signature");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 },
        );
      }

      // Printful uses HMAC-SHA256 with hex-encoded secret
      const secretKeyBytes = Buffer.from(secretKey, "hex");
      const expectedSignature = createHmac("sha256", secretKeyBytes)
        .update(rawBody)
        .digest("hex");

      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expectedSignature, "utf8");
      if (
        sigBuf.length !== expBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expBuf)
      ) {
        console.warn("Printful webhook: invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else {
      console.warn(
        "Printful webhook: PRINTFUL_WEBHOOK_SECRET not set, skipping signature verification",
      );
    }

    // Parse the webhook payload
    let payload: {
      data: {
        catalog_product_id?: number;
        // catalog_stock_updated / catalog_price_changed specific
        catalog_variant_id?: number;
        order?: {
          costs?: {
            additional_fee?: null | string;
            calculation_status?: string;
            currency?: null | string;
            digitization?: null | string;
            discount?: null | string;
            fulfillment_fee?: null | string;
            retail_delivery_fee?: null | string;
            shipping?: null | string;
            subtotal?: null | string;
            tax?: null | string;
            total?: null | string;
            vat?: null | string;
          };
          external_id?: null | string;
          id?: number;
          status?: string;
        };
        reason?: string;
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
          tracking_events?: {
            description: string;
            triggered_at: string;
          }[];
          tracking_number?: string;
          tracking_url?: string;
        };
        status?: string;
        stock_status?: string;
        sync_product?: {
          external_id?: null | string;
          id: number;
          is_ignored?: boolean;
          name?: string;
          synced?: number;
          thumbnail_url?: null | string;
          variants?: number;
        };
        // mockup_task_finished specific
        task_id?: string;
      };
      occurred_at?: string;
      retries?: number;
      store_id?: number;
      type: string;
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload.type;

    console.log(`Printful webhook received: ${eventType}`);

    // ========================================================================
    // Product sync events
    // ========================================================================

    if (eventType === "product_synced" && payload.data.sync_product) {
      const result = await handleProductSynced({
        sync_product: payload.data.sync_product as Parameters<
          typeof handleProductSynced
        >[0]["sync_product"],
      });
      if (!result.success) {
        console.warn(`Printful product_synced failed: ${result.error}`);
      }
      return NextResponse.json({ received: true });
    }

    if (eventType === "product_updated" && payload.data.sync_product) {
      const result = await handleProductUpdated({
        sync_product: payload.data.sync_product as Parameters<
          typeof handleProductUpdated
        >[0]["sync_product"],
      });
      if (!result.success) {
        console.warn(`Printful product_updated failed: ${result.error}`);
      }
      return NextResponse.json({ received: true });
    }

    if (eventType === "product_deleted" && payload.data.sync_product) {
      const result = await handleProductDeleted({
        sync_product: { id: payload.data.sync_product.id },
      });
      if (!result.success) {
        console.warn(`Printful product_deleted failed: ${result.error}`);
      }
      return NextResponse.json({ received: true });
    }

    // ========================================================================
    // Catalog events (v2): stock updates and price changes
    // ========================================================================

    if (eventType === "catalog_stock_updated") {
      const variantId = payload.data.catalog_variant_id;
      const stockStatus = payload.data.stock_status;
      if (variantId != null && stockStatus) {
        // Find local variants with this catalog_variant_id (externalId)
        const externalIdStr = String(variantId);
        try {
          const variants = await db
            .select({ id: productVariantsTable.id })
            .from(productVariantsTable)
            .where(eq(productVariantsTable.externalId, externalIdStr));

          if (variants.length > 0) {
            const ids = variants.map((v) => v.id);
            // Map Printful stock status to our availability status
            const availability =
              stockStatus === "in_stock" ? "in_stock" : "out_of_stock";
            await db
              .update(productVariantsTable)
              .set({
                availabilityStatus: availability,
                updatedAt: new Date(),
              })
              .where(inArray(productVariantsTable.id, ids));
            console.log(
              `catalog_stock_updated: updated ${variants.length} variant(s) for catalog variant ${variantId} to ${availability}`,
            );
          }
        } catch (err) {
          console.warn("catalog_stock_updated handler error:", err);
        }
      }
      return NextResponse.json({ received: true });
    }

    if (eventType === "catalog_price_changed") {
      // Log for admin awareness; automatic price adjustment is dangerous, so we just alert
      const productId = payload.data.catalog_product_id;
      const variantId = payload.data.catalog_variant_id;
      console.warn(
        `[Printful] catalog_price_changed: catalog_product_id=${productId}, catalog_variant_id=${variantId}. Review wholesale pricing and update retail prices if needed.`,
      );
      // TODO: Optionally send admin notification (email/Telegram) about price change
      return NextResponse.json({ received: true });
    }

    // ========================================================================
    // Legacy stock_updated (v1 - every 24h)
    // ========================================================================

    if (eventType === "stock_updated") {
      console.log(
        "Printful stock_updated event received (v1, 24h interval) - consider using catalog_stock_updated (v2) for real-time updates",
      );
      return NextResponse.json({ received: true });
    }

    // ========================================================================
    // Mockup task events
    // ========================================================================

    if (eventType === "mockup_task_finished") {
      const taskId = payload.data.task_id;
      const status = payload.data.status;
      console.log(
        `Printful mockup_task_finished: task=${taskId}, status=${status}`,
      );
      // Mockup task results can be retrieved via GET /v2/mockup-tasks/{id}
      // Implementation depends on how mockups are used in the product flow
      return NextResponse.json({ received: true });
    }

    // ========================================================================
    // Order and shipment events → delegate to order handler
    // ========================================================================

    const orderId = payload.data.order?.id;
    const externalId = payload.data.order?.external_id;

    if (orderId) {
      console.log(
        `Printful webhook: order event ${eventType} for order ${orderId} (external: ${externalId})`,
      );
    }

    // Get the Printful order ID to look up our order
    let printfulOrderId: null | string = null;

    if (orderId) {
      printfulOrderId = String(orderId);
    }

    if (!printfulOrderId) {
      // Some events might not have order info - that's okay
      console.log(`Printful webhook ${eventType}: no order ID, skipping`);
      return NextResponse.json({ received: true });
    }

    // Process the webhook event (handles all order/shipment events including
    // order_refunded, shipment_out_of_stock, shipment_canceled,
    // shipment_put_hold, shipment_put_hold_approval, etc.)
    const result = await updateOrderFromPrintfulWebhook(printfulOrderId, {
      data: {
        order: payload.data.order,
        shipment: payload.data.shipment,
      },
      type: eventType,
    });

    if (!result.success) {
      console.warn(`Printful webhook processing failed: ${result.error}`);
      // Still return 200 to prevent retries for non-transient errors
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Printful webhook error:", error);
    // Return 500 for transient errors so Printful will retry
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
