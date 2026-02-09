/**
 * Printify webhook registration API.
 * This is the only way to register or update Printify webhooks—Printify has no webhook UI
 * in their front-end/dashboard for API stores. Do not direct users to Printify's site for webhooks.
 */
import { type NextRequest, NextResponse } from "next/server";

import {
  createPrintifyWebhook,
  deletePrintifyWebhook,
  listPrintifyWebhooks,
  getPrintifyIfConfigured,
  type PrintifyWebhookEventType,
} from "~/lib/printify";
import { auth, isAdminUser } from "~/lib/auth";

/** All webhook topics we want to subscribe to for full sync */
const REQUIRED_WEBHOOK_TOPICS: PrintifyWebhookEventType[] = [
  "product:publish:started",
  "product:published",
  "product:deleted",
  "order:created",
  "order:updated",
  "order:sent-to-production",
  "order:shipment:created",
  "order:shipment:delivered",
  "shop:disconnected",
];

/**
 * GET /api/admin/printify/webhooks
 * List all registered Printify webhooks for the shop.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID." },
      { status: 400 },
    );
  }

  try {
    const webhooks = await listPrintifyWebhooks(pf.shopId);
    
    // Check which required topics are missing
    const registeredTopics = new Set(webhooks.map((w) => w.topic));
    const missingTopics = REQUIRED_WEBHOOK_TOPICS.filter(
      (topic) => !registeredTopics.has(topic),
    );

    return NextResponse.json({
      shopId: pf.shopId,
      webhooks,
      missingTopics,
      allRegistered: missingTopics.length === 0,
      webhookEndpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printify`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to list webhooks", detail: message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/printify/webhooks
 * Register webhooks with Printify.
 *
 * Body options:
 * - { action: "register_all" } - Register all required webhooks
 * - { action: "register", topic: "product:published" } - Register a single webhook
 * - { action: "delete", webhookId: "abc123" } - Delete a webhook
 * - { action: "delete_all" } - Delete all webhooks
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID." },
      { status: 400 },
    );
  }

  let body: {
    action: string;
    topic?: PrintifyWebhookEventType;
    webhookId?: string;
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
  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not set and no customUrl provided" },
      { status: 400 },
    );
  }

  // Add secret to URL if configured
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET;
  const webhookUrl = secret
    ? `${baseUrl}/api/webhooks/printify?secret=${encodeURIComponent(secret)}`
    : `${baseUrl}/api/webhooks/printify`;

  switch (action) {
    case "register_all": {
      console.log(`Registering all Printify webhooks for shop ${pf.shopId}...`);
      
      // First, get existing webhooks to avoid duplicates
      const existing = await listPrintifyWebhooks(pf.shopId);
      const existingTopics = new Set(existing.map((w) => w.topic));

      const results: { topic: string; success: boolean; error?: string; id?: string }[] = [];

      for (const topic of REQUIRED_WEBHOOK_TOPICS) {
        if (existingTopics.has(topic)) {
          results.push({ topic, success: true, error: "Already registered" });
          continue;
        }

        try {
          const webhook = await createPrintifyWebhook(pf.shopId, topic, webhookUrl);
          results.push({ topic, success: true, id: webhook.id });
          console.log(`Registered webhook: ${topic} -> ${webhook.id}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ topic, success: false, error: message });
          console.error(`Failed to register webhook ${topic}:`, message);
        }
      }

      const successCount = results.filter((r) => r.success && r.id).length;
      const alreadyRegistered = results.filter((r) => r.success && !r.id).length;
      const failedCount = results.filter((r) => !r.success).length;

      return NextResponse.json({
        success: failedCount === 0,
        summary: {
          registered: successCount,
          alreadyRegistered,
          failed: failedCount,
        },
        results,
        webhookUrl,
      });
    }

    case "register": {
      if (!body.topic) {
        return NextResponse.json(
          { error: "topic required for register action" },
          { status: 400 },
        );
      }

      try {
        const webhook = await createPrintifyWebhook(pf.shopId, body.topic, webhookUrl);
        return NextResponse.json({
          success: true,
          webhook,
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

    case "delete": {
      if (!body.webhookId) {
        return NextResponse.json(
          { error: "webhookId required for delete action" },
          { status: 400 },
        );
      }

      const result = await deletePrintifyWebhook(pf.shopId, body.webhookId);
      return NextResponse.json(result);
    }

    case "delete_all": {
      console.log(`Deleting all Printify webhooks for shop ${pf.shopId}...`);
      
      const existing = await listPrintifyWebhooks(pf.shopId);
      const results: { id: string; topic: string; success: boolean }[] = [];

      for (const webhook of existing) {
        const result = await deletePrintifyWebhook(pf.shopId, webhook.id);
        results.push({ id: webhook.id, topic: webhook.topic, success: result.success });
      }

      return NextResponse.json({
        success: results.every((r) => r.success),
        deleted: results.filter((r) => r.success).length,
        results,
      });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid: register_all, register, delete, delete_all` },
        { status: 400 },
      );
  }
}
