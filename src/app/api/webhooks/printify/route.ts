/**
 * Printify Webhook Handler
 *
 * Receives webhook events from Printify for order and product updates.
 *
 * Order Events:
 * - order:created, order:updated, order:sent-to-production
 * - order:shipment:created, order:shipment:delivered
 *
 * Product Events:
 * - product:publish:started - Publish started (we import; product may still be "publishing")
 * - product:published - Publish completed (we import again to ensure data is final)
 * - product:deleted - Product deleted from Printify
 *
 * Security: Printify doesn't sign webhooks with HMAC like Printful.
 * In production, set PRINTIFY_WEBHOOK_SECRET and configure your webhook URL
 * to include it (e.g. https://your-domain.com/api/webhooks/printify?secret=YOUR_SECRET).
 * When the secret is set, requests without the matching secret are rejected.
 */

import { type NextRequest, NextResponse } from "next/server";

import { updateOrderFromPrintifyWebhook } from "~/lib/printify-orders";
import {
  handlePrintifyProductPublished,
  handlePrintifyProductDeleted,
} from "~/lib/printify-sync";

// Printify webhook event structure
type PrintifyWebhookPayload = {
  id: string;
  type: string;
  created_at: string;
  resource: {
    id: string;
    type: "shop" | "product" | "order";
    data: {
      status?: string;
      shipment?: {
        carrier?: string;
        number?: string;
        url?: string;
        delivered_at?: string | null;
      };
      [key: string]: unknown;
    };
  };
};

/**
 * POST /api/webhooks/printify
 * Handle incoming Printify webhook events.
 * When PRINTIFY_WEBHOOK_SECRET is set, the secret must be present in the URL (?secret=...) and match.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const secretParam = request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.PRINTIFY_WEBHOOK_SECRET?.trim();

    if (expectedSecret) {
      if (!secretParam || secretParam !== expectedSecret) {
        console.warn("Printify webhook: Missing or invalid secret");
        return NextResponse.json(
          { error: "Invalid or missing webhook secret" },
          { status: 401 },
        );
      }
    }

    // Parse payload
    let payload: PrintifyWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as PrintifyWebhookPayload;
    } catch {
      console.error("Printify webhook: Invalid JSON payload");
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload.type;
    const resourceType = payload.resource?.type;
    const resourceId = payload.resource?.id;

    console.log(
      `Printify webhook received: ${eventType} for ${resourceType} ${resourceId}`,
    );

    // Handle product events
    if (resourceType === "product") {
      // Import when publish starts or when publish completes (product may be "publishing" for a few minutes)
      if (
        (eventType === "product:publish:started" ||
          eventType === "product:published") &&
        resourceId
      ) {
        const result = await handlePrintifyProductPublished({ id: resourceId });
        if (!result.success) {
          console.warn(
            `Printify ${eventType} failed: ${result.error}`,
          );
        }
        return NextResponse.json({ received: true });
      }

      if (eventType === "product:deleted" && resourceId) {
        const result = await handlePrintifyProductDeleted({ id: resourceId });
        if (!result.success) {
          console.warn(`Printify product:deleted failed: ${result.error}`);
        }
        return NextResponse.json({ received: true });
      }

      // Other product events - log and continue
      console.log(`Printify webhook: Unhandled product event (${eventType})`);
      return NextResponse.json({ received: true });
    }

    // Handle shop disconnection
    if (resourceType === "shop" && eventType === "shop:disconnected") {
      console.warn(`Printify shop disconnected: ${resourceId}`);
      // Could trigger alerts or disable syncing
      return NextResponse.json({ received: true });
    }

    // Handle order events
    if (resourceType !== "order") {
      console.log(
        `Printify webhook: Ignoring non-order event (${resourceType})`,
      );
      return NextResponse.json({ received: true });
    }

    // Get the Printify order ID
    const printifyOrderId = resourceId;
    if (!printifyOrderId) {
      console.warn("Printify webhook: Missing order ID");
      return NextResponse.json({ error: "Missing order ID" }, { status: 400 });
    }

    // Update our order based on the event
    const result = await updateOrderFromPrintifyWebhook(printifyOrderId, {
      type: eventType,
      data: {
        status: payload.resource.data?.status,
        shipment: payload.resource.data?.shipment,
      },
    });

    if (!result.success) {
      console.error(`Printify webhook processing failed: ${result.error}`);
      // Return 200 anyway to prevent retries for expected errors (e.g., order not found)
      // Printify will retry on non-2xx responses
    }

    return NextResponse.json({
      received: true,
      processed: result.success,
      error: result.error,
    });
  } catch (error) {
    console.error("Printify webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/webhooks/printify
 * Health check / verification endpoint
 */
export async function GET(request: NextRequest) {
  // Optionally verify secret
  const secretParam = request.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.PRINTIFY_WEBHOOK_SECRET;

  if (expectedSecret && secretParam !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ok",
    service: "printify-webhook",
    timestamp: new Date().toISOString(),
  });
}
