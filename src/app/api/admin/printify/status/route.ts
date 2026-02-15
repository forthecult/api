/**
 * GET /api/admin/printify/status
 *
 * Check Printify API configuration and connectivity.
 * Returns configuration status and can test API connectivity.
 */

import { type NextRequest, NextResponse } from "next/server";

import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  fetchPrintifyShops,
  getPrintifyIfConfigured,
  listPrintifyWebhooks,
} from "~/lib/printify";

export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getPrintifyIfConfigured();

    const result: {
      apiConnected: boolean;
      configured: boolean;
      error?: string;
      shopId: null | string;
      shops: { id: number; sales_channel: string; title: string }[];
      webhooks: { id: string; topic: string; url: string }[];
      webhookSecretConfigured: boolean;
    } = {
      apiConnected: false,
      configured: config !== null,
      shopId: config?.shopId ?? null,
      shops: [],
      webhooks: [],
      webhookSecretConfigured: Boolean(process.env.PRINTIFY_WEBHOOK_SECRET),
    };

    if (!config) {
      result.error =
        "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID environment variables.";
      return NextResponse.json(result);
    }

    // Test API connectivity by fetching shops
    try {
      const shops = await fetchPrintifyShops();
      result.apiConnected = true;
      result.shops = shops.map((s) => ({
        id: s.id,
        sales_channel: s.sales_channel,
        title: s.title,
      }));

      // Verify the configured shop ID exists
      const shopExists = shops.some((s) => String(s.id) === config.shopId);
      if (!shopExists) {
        result.error = `Configured PRINTIFY_SHOP_ID (${config.shopId}) not found in account. Available shops: ${shops.map((s) => s.id).join(", ")}`;
      }

      // Try to fetch webhooks for the configured shop
      try {
        const webhooks = await listPrintifyWebhooks(config.shopId);
        result.webhooks = webhooks.map((w) => ({
          id: w.id,
          topic: w.topic,
          url: w.url,
        }));
      } catch (webhookError) {
        console.warn("Failed to fetch Printify webhooks:", webhookError);
        // Not a critical error
      }
    } catch (apiError) {
      result.error =
        apiError instanceof Error
          ? apiError.message
          : "Failed to connect to Printify API";
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Printify status check error:", err);
    return NextResponse.json(
      {
        apiConnected: false,
        configured: false,
        error: "Internal server error",
        shopId: null,
        shops: [],
        webhooks: [],
        webhookSecretConfigured: false,
      },
      { status: 500 },
    );
  }
}
