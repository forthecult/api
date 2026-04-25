import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { ordersTable, webhookRegistrationsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * Register a webhook URL to receive POST notifications when order status changes.
 * POST /api/webhooks
 * Body: { url: string, secret?: string, events?: string, orderId?: string }
 *
 * Auth: either admin (can register global webhooks) or any user providing a valid
 * orderId (webhook is scoped to that single order). Rate-limited for non-admin callers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      events?: string;
      orderId?: string;
      secret?: string;
      url?: string;
    };

    const isAdmin = (await getAdminAuth(request))?.ok === true;

    // Non-admin callers MUST provide an orderId (scoped webhook) and are rate-limited
    const scopedOrderId =
      typeof body.orderId === "string" && body.orderId.trim()
        ? body.orderId.trim()
        : null;

    if (!isAdmin) {
      // Rate limit non-admin webhook registrations
      const ip = getClientIp(request.headers);
      const rl = await checkRateLimit(`webhook-register:${ip}`, {
        limit: 10,
        windowSeconds: 60,
      });
      if (!rl.success) return rateLimitResponse(rl);

      if (!scopedOrderId) {
        return NextResponse.json(
          {
            error:
              "orderId is required. Provide the order ID to receive status updates for that order. Admin auth is required for global webhooks.",
          },
          { status: 400 },
        );
      }

      // Verify the order exists
      const [order] = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.id, scopedOrderId))
        .limit(1);
      if (!order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
    }

    const url =
      typeof body.url === "string" && body.url.trim() ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    if (!isValidWebhookUrl(url)) {
      return NextResponse.json(
        {
          error: "url must be a valid HTTPS URL pointing to a public endpoint",
        },
        { status: 400 },
      );
    }

    const id = createId();
    const now = new Date();
    await db.insert(webhookRegistrationsTable).values({
      createdAt: now,
      events:
        typeof body.events === "string" && body.events.trim()
          ? body.events.trim()
          : "order.updated",
      id,
      secret: typeof body.secret === "string" ? body.secret : null,
      url,
      // Store orderId scope so webhook dispatcher only fires for this order
      ...(scopedOrderId ? { orderId: scopedOrderId } : {}),
    });

    return NextResponse.json({
      events: "order.updated",
      id,
      url,
      ...(scopedOrderId ? { orderId: scopedOrderId } : {}),
      message: scopedOrderId
        ? `Webhook registered for order ${scopedOrderId}. You will receive POST requests when this order's status changes.`
        : "Webhook registered. You will receive POST requests when order status changes.",
    });
  } catch (err) {
    console.error("Webhook registration error:", err);
    return NextResponse.json(
      { error: "Failed to register webhook" },
      { status: 500 },
    );
  }
}

/** Validate that a webhook URL is a safe, non-private HTTPS endpoint. */
function isValidWebhookUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    // Block localhost and private IPs
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    )
      return false;
    if (hostname.startsWith("10.") || hostname.startsWith("192.168."))
      return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return false;
    if (hostname === "169.254.169.254") return false; // AWS metadata
    if (hostname.endsWith(".local") || hostname.endsWith(".internal"))
      return false;
    return true;
  } catch {
    return false;
  }
}
