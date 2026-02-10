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
 * - product:publish:started - Publish started (we return 200 immediately, then import in background)
 * - product:published - Publish completed (same: 200 first, import in background)
 * - product:deleted - Product deleted from Printify (200 first, unpublish in background)
 *
 * We return 200 immediately for product events so Printify can mark the product as "Published"
 * on their side. If we awaited the full import, Printify could timeout and leave products
 * stuck in "Publishing".
 *
 * Security: Printify doesn't sign webhooks with HMAC like Printful.
 * In production, set PRINTIFY_WEBHOOK_SECRET and configure your webhook URL
 * to include it (e.g. https://forthecult.store/api/webhooks/printify?secret=YOUR_SECRET).
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
  const rawBody = await request.text();
  console.info(
    `[Printify webhook] POST received (body length: ${rawBody?.length ?? 0}, has secret: ${!!request.nextUrl.searchParams.get("secret")})`,
  );
  try {

    // Validation-style request (empty or non-webhook payload): return 200 before checking secret.
    // Printify may validate the URL without the secret query param, which would otherwise cause 401 and 9004.
    if (!rawBody?.trim()) {
      return NextResponse.json({ received: true });
    }
    let payload: PrintifyWebhookPayload | null = null;
    try {
      payload = JSON.parse(rawBody) as PrintifyWebhookPayload;
    } catch {
      return NextResponse.json({ received: true });
    }
    if (!payload?.type || !payload?.resource) {
      return NextResponse.json({ received: true });
    }

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

    const eventType = payload.type;
    const resourceType = payload.resource?.type;
    // Printify may send id as string or number; normalize to string for API calls
    const resourceId =
      payload.resource?.id != null
        ? String(payload.resource.id)
        : undefined;

    console.log(
      `Printify webhook received: ${eventType} for ${resourceType} ${resourceId}`,
    );

    // Handle product events
    if (resourceType === "product") {
      // Import when publish starts or when publish completes (product may be "publishing" for a few minutes).
      // Return 200 immediately so Printify marks the product as "Published" on their side; process import in
      // background. If we await the full import, Printify may timeout and keep the product stuck in "Publishing".
      if (
        (eventType === "product:publish:started" ||
          eventType === "product:published") &&
        resourceId
      ) {
        void handlePrintifyProductPublished({ id: resourceId })
          .then((result) => {
            if (!result.success) {
              console.warn(
                `Printify ${eventType} import failed: ${result.error}`,
              );
            } else {
              console.log(
                `Printify ${eventType}: product ${resourceId} imported successfully`,
              );
            }
          })
          .catch((err) => {
            console.error(
              `Printify ${eventType} import error for ${resourceId}:`,
              err,
            );
          });
        return NextResponse.json({ received: true });
      }

      if (eventType === "product:deleted" && resourceId) {
        void handlePrintifyProductDeleted({ id: resourceId })
          .then((result) => {
            if (!result.success) {
              console.warn(`Printify product:deleted failed: ${result.error}`);
            }
          })
          .catch((err) => {
            console.error(
              `Printify product:deleted error for ${resourceId}:`,
              err,
            );
          });
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
 * Health check and Printify webhook validation endpoint.
 * Always returns 200 so Printify's URL validation (code 9004) succeeds when they
 * GET this URL during registration.
 */
export async function GET(request: NextRequest) {
  console.info("[Printify webhook] GET received (validation check)");
  return NextResponse.json({
    status: "ok",
    service: "printify-webhook",
    timestamp: new Date().toISOString(),
  });
}

/**
 * HEAD /api/webhooks/printify
 * Some providers validate with HEAD; return 200 so registration (9004) succeeds.
 */
export async function HEAD() {
  console.info("[Printify webhook] HEAD received (validation check)");
  return new NextResponse(null, { status: 200 });
}
