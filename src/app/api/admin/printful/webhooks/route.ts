import { type NextRequest, NextResponse } from "next/server";

import {
  getWebhookConfig,
  setWebhookConfig,
  disableWebhook,
  getPrintfulIfConfigured,
} from "~/lib/printful";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * All webhook event types we want to subscribe to for full order/product sync.
 * See: https://developers.printful.com/docs/#tag/Webhook-API
 *
 * Note: stock_updated requires product IDs to be specified, so we exclude it
 * from the default registration. POD products are made-to-order anyway.
 */
const REQUIRED_WEBHOOK_TYPES = [
  // Order events
  "package_shipped",      // Shipment has shipped (legacy name: shipment_sent)
  "package_returned",     // Package returned (legacy name: shipment_returned)
  "order_created",        // Order created
  "order_updated",        // Order status changed
  "order_failed",         // Order failed at Printful
  "order_canceled",       // Order cancelled
  "order_put_hold",       // Order put on hold
  "order_put_hold_approval", // Order waiting for approval
  "order_remove_hold",    // Order removed from hold
  // Product sync events
  "product_synced",       // Product created/synced
  "product_updated",      // Product updated
  "product_deleted",      // Product deleted
  // Note: "stock_updated" excluded - requires product IDs and POD is made-to-order
];

/**
 * GET /api/admin/printful/webhooks
 * Get current webhook configuration from Printful.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  try {
    const config = await getWebhookConfig();
    
    // Check which required types are missing
    const registeredTypes = new Set(config?.types ?? []);
    const missingTypes = REQUIRED_WEBHOOK_TYPES.filter(
      (type) => !registeredTypes.has(type),
    );

    return NextResponse.json({
      configured: config != null,
      url: config?.url ?? null,
      types: config?.types ?? [],
      missingTypes,
      allRegistered: config != null && missingTypes.length === 0,
      webhookEndpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`,
      requiredTypes: REQUIRED_WEBHOOK_TYPES,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to get webhook config", detail: message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/printful/webhooks
 * Configure webhooks with Printful.
 *
 * Body options:
 * - { action: "register_all" } - Register all required webhook types
 * - { action: "register", types: ["product_synced", "order_updated"] } - Register specific types
 * - { action: "disable" } - Disable all webhooks
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  let body: {
    action: string;
    types?: string[];
    customUrl?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  // Build webhook URL - use custom URL if provided, otherwise use app URL
  const baseUrl = body.customUrl || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl && action !== "disable") {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not set and no customUrl provided" },
      { status: 400 },
    );
  }

  const webhookUrl = `${baseUrl}/api/webhooks/printful`;

  switch (action) {
    case "register_all": {
      console.log("Registering all Printful webhooks...");

      try {
        const config = await setWebhookConfig({
          url: webhookUrl,
          types: REQUIRED_WEBHOOK_TYPES,
        });

        console.log(`Printful webhooks registered: ${config.types.join(", ")}`);

        return NextResponse.json({
          success: true,
          url: config.url,
          types: config.types,
          webhookUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to register Printful webhooks:", message);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
      }
    }

    case "register": {
      if (!body.types || body.types.length === 0) {
        return NextResponse.json(
          { error: "types array required for register action" },
          { status: 400 },
        );
      }

      try {
        // Get existing config to merge types
        const existing = await getWebhookConfig();
        const existingTypes = new Set(existing?.types ?? []);
        const newTypes = [...existingTypes, ...body.types];
        const uniqueTypes = [...new Set(newTypes)];

        const config = await setWebhookConfig({
          url: webhookUrl,
          types: uniqueTypes,
        });

        return NextResponse.json({
          success: true,
          url: config.url,
          types: config.types,
          webhookUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
      }
    }

    case "disable": {
      console.log("Disabling Printful webhooks...");

      try {
        await disableWebhook();
        console.log("Printful webhooks disabled");
        return NextResponse.json({ success: true, disabled: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
      }
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid: register_all, register, disable` },
        { status: 400 },
      );
  }
}
