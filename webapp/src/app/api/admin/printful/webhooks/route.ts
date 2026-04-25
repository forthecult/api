import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  disableWebhook,
  getPrintfulIfConfigured,
  getWebhookConfig,
  setWebhookConfig,
} from "~/lib/printful";

/**
 * All webhook event types we want to subscribe to for full order/product/catalog sync.
 * Includes both v1 legacy names and v2 event names.
 *
 * v2 additions: shipment_sent/delivered/returned/out_of_stock/canceled/put_hold,
 * catalog_stock_updated, catalog_price_changed, order_refunded, mockup_task_finished.
 */
const REQUIRED_WEBHOOK_TYPES = [
  // Order events
  "order_created",
  "order_updated",
  "order_failed",
  "order_canceled",
  "order_refunded",
  "order_put_hold",
  "order_put_hold_approval",
  "order_remove_hold",
  // Shipment events (v2 naming)
  "shipment_sent",
  "shipment_delivered",
  "shipment_returned",
  "shipment_out_of_stock",
  "shipment_canceled",
  "shipment_put_hold",
  "shipment_put_hold_approval",
  "shipment_remove_hold",
  // Legacy shipment events (v1 compat – some accounts still send these)
  "package_shipped",
  "package_returned",
  // Product sync events
  "product_synced",
  "product_updated",
  "product_deleted",
  // Catalog events (v2 – real-time stock + price changes)
  "catalog_stock_updated",
  "catalog_price_changed",
  // Mockup events
  "mockup_task_finished",
];

/**
 * GET /api/admin/printful/webhooks
 * Get current webhook configuration from Printful.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

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
      allRegistered: config != null && missingTypes.length === 0,
      configured: config != null,
      missingTypes,
      requiredTypes: REQUIRED_WEBHOOK_TYPES,
      types: config?.types ?? [],
      url: config?.url ?? null,
      webhookEndpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: message, error: "Failed to get webhook config" },
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
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  let body: {
    action: string;
    customUrl?: string;
    types?: string[];
  };

  try {
    body = (await request.json()) as typeof body;
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
          types: REQUIRED_WEBHOOK_TYPES,
          url: webhookUrl,
        });

        console.log(`Printful webhooks registered: ${config.types.join(", ")}`);

        return NextResponse.json({
          success: true,
          types: config.types,
          url: config.url,
          webhookUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Failed to register Printful webhooks:", message);
        return NextResponse.json(
          { error: message, success: false },
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
          types: uniqueTypes,
          url: webhookUrl,
        });

        return NextResponse.json({
          success: true,
          types: config.types,
          url: config.url,
          webhookUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: message, success: false },
          { status: 500 },
        );
      }
    }

    case "disable": {
      console.log("Disabling Printful webhooks...");

      try {
        await disableWebhook();
        console.log("Printful webhooks disabled");
        return NextResponse.json({ disabled: true, success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: message, success: false },
          { status: 500 },
        );
      }
    }

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: register_all, register, disable`,
        },
        { status: 400 },
      );
  }
}
