import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { fetchCatalogProducts, getPrintfulIfConfigured } from "~/lib/printful";

/**
 * GET /api/admin/printful/status
 *
 * Admin endpoint to check Printful API configuration and connectivity.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintfulIfConfigured();

  if (!pf) {
    return NextResponse.json({
      configured: false,
      error: "PRINTFUL_API_TOKEN not set",
      message:
        "Add PRINTFUL_API_TOKEN to your environment variables to enable Printful integration",
    });
  }

  try {
    // Test API connectivity by fetching products
    const response = await fetchCatalogProducts({ limit: 1 });

    return NextResponse.json({
      _setup: {
        events: [
          "shipment_sent",
          "shipment_delivered",
          "order_updated",
          "order_failed",
          "order_canceled",
          "shipment_returned",
        ],
        webhookUrl:
          "Configure webhook at Printful dashboard: /api/webhooks/printful",
      },
      configured: true,
      connected: true,
      message: "Printful API is configured and connected",
      testProduct: response.data.length > 0 ? response.data[0] : null,
      webhookSecretConfigured: Boolean(process.env.PRINTFUL_WEBHOOK_SECRET),
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Printful API token is set but connection failed",
    });
  }
}
