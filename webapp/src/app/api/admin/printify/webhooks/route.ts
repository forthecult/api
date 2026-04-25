/**
 * Printify webhook registration API.
 * This is the only way to register or update Printify webhooks—Printify has no webhook UI
 * in their front-end/dashboard for API stores. Do not direct users to Printify's site for webhooks.
 */
import { type NextRequest, NextResponse } from "next/server";

import {
  createPrintifyWebhook,
  deletePrintifyWebhook,
  getPrintifyIfConfigured,
  listPrintifyWebhooks,
  type PrintifyWebhookEventType,
} from "~/lib/printify";

/** When true, register_all deletes all existing webhooks first so only our URL receives events (fixes stuck "Publishing"). */
const REPLACE_ALL_WEBHOOKS_ON_REGISTER = true;
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

/** Extract hostname from a URL for Printify's required `host` query parameter on DELETE. */
function extractHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // Fallback: strip protocol and path
    return url.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
  }
}

/**
 * All webhook topics we want to subscribe to for full sync.
 * These must be valid Printify subscription topics per their OpenAPI spec.
 * Note: "product:published" is NOT a valid topic — only "product:publish:started" exists.
 * Printify fires product:publish:started when a product publish is initiated; our webhook
 * handler also checks for "product:published" in the payload type just in case.
 */
const REQUIRED_WEBHOOK_TOPICS: PrintifyWebhookEventType[] = [
  "product:publish:started",
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
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      {
        error:
          "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID.",
      },
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
      allRegistered: missingTopics.length === 0,
      missingTopics,
      shopId: pf.shopId,
      webhookEndpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printify`,
      webhooks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { detail: message, error: "Failed to list webhooks" },
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
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      {
        error:
          "Printify not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID.",
      },
      { status: 400 },
    );
  }

  let body: {
    action: string;
    customUrl?: string;
    topic?: PrintifyWebhookEventType;
    /** For delete_where_url_contains: delete only webhooks whose URL contains this string (e.g. "staging") */
    urlContains?: string;
    webhookId?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  // l8: only accept a customUrl if its origin matches NEXT_PUBLIC_APP_URL so an
  // admin (or a stolen admin session) can't point printify webhooks at an
  // attacker-controlled host to harvest order events / signing secrets.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  const customUrlRaw = body.customUrl?.trim() ?? "";
  if (customUrlRaw) {
    const parseOrigin = (raw: string): null | string => {
      try {
        return new URL(raw).origin.toLowerCase();
      } catch {
        return null;
      }
    };
    const appOrigin = parseOrigin(appUrl);
    const customOrigin = parseOrigin(customUrlRaw);
    if (!appOrigin || !customOrigin || customOrigin !== appOrigin) {
      return NextResponse.json(
        {
          allowedOrigin: appOrigin,
          customOrigin,
          error: "customUrl must be on the same origin as NEXT_PUBLIC_APP_URL.",
        },
        { status: 400 },
      );
    }
  }

  // Build webhook URL - use custom URL (same-origin) if provided, otherwise use app URL
  const baseUrl = (customUrlRaw || appUrl).replace(/\/+$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL not set and no customUrl provided" },
      { status: 400 },
    );
  }

  const secret = process.env.PRINTIFY_WEBHOOK_SECRET?.trim();
  // If customUrl is already the full webhook path, use it as-is (allows registering without secret to debug 9004)
  const isFullWebhookUrl = baseUrl.includes("/api/webhooks/printify");
  const webhookUrl = isFullWebhookUrl
    ? secret
      ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}secret=${encodeURIComponent(secret)}`
      : baseUrl
    : secret
      ? `${baseUrl}/api/webhooks/printify?secret=${encodeURIComponent(secret)}`
      : `${baseUrl}/api/webhooks/printify`;

  switch (action) {
    case "delete_all": {
      console.log(`Deleting all Printify webhooks for shop ${pf.shopId}...`);

      const existing = await listPrintifyWebhooks(pf.shopId);
      const results: {
        id: string;
        success: boolean;
        topic: string;
        url: string;
      }[] = [];

      for (const webhook of existing) {
        // Extract host from each webhook's registered URL for the required host parameter
        const webhookHost = extractHostFromUrl(webhook.url);
        const result = await deletePrintifyWebhook(
          pf.shopId,
          webhook.id,
          webhookHost,
        );
        results.push({
          id: webhook.id,
          success: result.success,
          topic: webhook.topic,
          url: webhook.url,
        });
      }

      return NextResponse.json({
        deleted: results.filter((r) => r.success).length,
        results,
        success: results.every((r) => r.success),
      });
    }

    case "delete_where_url_contains": {
      const fragment = body.urlContains?.trim();
      if (!fragment) {
        return NextResponse.json(
          {
            error:
              'urlContains required (e.g. "staging" to remove staging webhooks)',
          },
          { status: 400 },
        );
      }
      console.log(
        `Deleting Printify webhooks for shop ${pf.shopId} where URL contains "${fragment}"...`,
      );

      const existing = await listPrintifyWebhooks(pf.shopId);
      const toDelete = existing.filter((w) => w.url.includes(fragment));
      const results: {
        id: string;
        success: boolean;
        topic: string;
        url: string;
      }[] = [];

      for (const webhook of toDelete) {
        const webhookHost = extractHostFromUrl(webhook.url);
        const result = await deletePrintifyWebhook(
          pf.shopId,
          webhook.id,
          webhookHost,
        );
        results.push({
          id: webhook.id,
          success: result.success,
          topic: webhook.topic,
          url: webhook.url,
        });
      }

      return NextResponse.json({
        deleted: results.filter((r) => r.success).length,
        message: `Removed ${results.filter((r) => r.success).length} webhook(s) whose URL contains "${fragment}".`,
        results,
        success: results.every((r) => r.success),
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
        const webhook = await createPrintifyWebhook(
          pf.shopId,
          body.topic,
          webhookUrl,
        );
        return NextResponse.json({
          success: true,
          webhook,
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

    case "delete": {
      if (!body.webhookId) {
        return NextResponse.json(
          { error: "webhookId required for delete action" },
          { status: 400 },
        );
      }

      // For single delete, extract host from our app URL as a best guess
      const deleteHost = extractHostFromUrl(baseUrl);
      const result = await deletePrintifyWebhook(
        pf.shopId,
        body.webhookId,
        deleteHost,
      );
      return NextResponse.json(result);
    }

    case "register_all": {
      console.log(
        `Registering all Printify webhooks for shop ${pf.shopId}; URL: ${webhookUrl}`,
      );

      // Replace-all: delete every existing webhook first so only our URL receives events.
      // Otherwise Printify may have old/stale URLs (e.g. without secret); if any URL returns
      // non-2xx, Printify can leave products stuck in "Publishing".
      let deletedCount = 0;
      if (REPLACE_ALL_WEBHOOKS_ON_REGISTER) {
        const existing = await listPrintifyWebhooks(pf.shopId);
        for (const webhook of existing) {
          // Extract host from the webhook's registered URL for the required host query parameter
          const webhookHost = extractHostFromUrl(webhook.url);
          const res = await deletePrintifyWebhook(
            pf.shopId,
            webhook.id,
            webhookHost,
          );
          if (res.success) deletedCount++;
        }
        if (deletedCount > 0) {
          console.log(
            `Replaced ${deletedCount} existing Printify webhook(s) for shop ${pf.shopId}`,
          );
        }
      }

      const existingAfterDelete = await listPrintifyWebhooks(pf.shopId);
      const existingTopics = new Set(existingAfterDelete.map((w) => w.topic));

      const results: {
        error?: string;
        id?: string;
        success: boolean;
        topic: string;
      }[] = [];

      for (const topic of REQUIRED_WEBHOOK_TOPICS) {
        if (existingTopics.has(topic)) {
          results.push({ error: "Already registered", success: true, topic });
          continue;
        }

        try {
          const webhook = await createPrintifyWebhook(
            pf.shopId,
            topic,
            webhookUrl,
          );
          results.push({ id: webhook.id, success: true, topic });
          console.log(`Registered webhook: ${topic} -> ${webhook.id}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ error: message, success: false, topic });
          console.error(`Failed to register webhook ${topic}:`, message);
        }
      }

      const successCount = results.filter((r) => r.success && r.id).length;
      const alreadyRegistered = results.filter(
        (r) => r.success && !r.id,
      ).length;
      const failedCount = results.filter((r) => !r.success).length;

      const has9004 = results.some(
        (r) =>
          r.error?.includes("9004") ||
          r.error?.toLowerCase().includes("validation failed"),
      );
      return NextResponse.json({
        hint: !baseUrl.startsWith("https://")
          ? "NEXT_PUBLIC_APP_URL should be https in production so Printify can reach it."
          : has9004
            ? '9004: When you click Register, check server logs for \'[Printify webhook] GET received\' or \'POST received\'. If none appear, Printify\'s request is not reaching this app (wrong URL or blocked). Try registering with customUrl without secret: { "action": "register_all", "customUrl": "https://YOUR_DOMAIN/api/webhooks/printify" } to see if validation passes.'
            : undefined,
        results,
        success: failedCount === 0,
        summary: {
          alreadyRegistered,
          deleted: deletedCount,
          failed: failedCount,
          registered: successCount,
        },
        webhookUrl,
      });
    }

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: register_all, register, delete, delete_all, delete_where_url_contains`,
        },
        { status: 400 },
      );
  }
}
