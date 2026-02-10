import { createHmac } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import { updateOrderFromPrintfulWebhook } from "~/lib/printful-orders";
import {
  handleProductSynced,
  handleProductUpdated,
  handleProductDeleted,
} from "~/lib/printful-sync";

/**
 * POST /api/webhooks/printful
 *
 * Handles Printful webhook events (order and product sync).
 * Webhook signature verification using HMAC-SHA256 (header x-pf-webhook-signature).
 *
 * In production, PRINTFUL_WEBHOOK_SECRET is required; unverified requests are rejected.
 * Set the same hex secret in Printful's webhook settings and in this env var.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secretKey = process.env.PRINTFUL_WEBHOOK_SECRET?.trim();
    const isProduction = process.env.NODE_ENV === "production";

    // In production, require secret to be set so we never accept unverified webhooks
    if (isProduction && !secretKey) {
      console.warn("Printful webhook: PRINTFUL_WEBHOOK_SECRET required in production");
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

      if (signature !== expectedSignature) {
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
      type: string;
      occurred_at?: string;
      retries?: number;
      store_id?: number;
      data: {
        order?: {
          id?: number;
          external_id?: string | null;
          status?: string;
        };
        shipment?: {
          id?: number;
          status?: string;
          tracking_number?: string;
          tracking_url?: string;
        };
        sync_product?: {
          id: number;
          external_id?: string | null;
          name?: string;
          variants?: number;
          synced?: number;
          thumbnail_url?: string | null;
          is_ignored?: boolean;
        };
        reason?: string;
      };
    };

    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload.type;

    console.log(`Printful webhook received: ${eventType}`);

    // Handle product sync events
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

    // Handle stock_updated event (optional - could trigger inventory sync)
    if (eventType === "stock_updated") {
      console.log(
        "Printful stock_updated event received - stock info in Printful may have changed",
      );
      // For POD products, we typically don't track stock locally
      // since items are made to order. Log and continue.
      return NextResponse.json({ received: true });
    }

    // Handle order-related events
    const orderId = payload.data.order?.id;
    const externalId = payload.data.order?.external_id;

    if (orderId) {
      console.log(
        `Printful webhook: order event ${eventType} for order ${orderId} (external: ${externalId})`,
      );
    }

    // Get the Printful order ID to look up our order
    let printfulOrderId: string | null = null;

    if (orderId) {
      printfulOrderId = String(orderId);
    }

    if (!printfulOrderId) {
      // Some events might not have order info - that's okay
      console.log(`Printful webhook ${eventType}: no order ID, skipping`);
      return NextResponse.json({ received: true });
    }

    // Process the webhook event
    const result = await updateOrderFromPrintfulWebhook(printfulOrderId, {
      type: eventType,
      data: {
        order: payload.data.order,
        shipment: payload.data.shipment,
      },
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

// Also support GET for webhook URL verification (if Printful sends verification requests)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Printful webhook endpoint",
  });
}
