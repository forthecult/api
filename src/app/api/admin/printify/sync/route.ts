import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import {
  importAllPrintifyProducts,
  importSinglePrintifyProduct,
  exportProductToPrintify,
  exportAllPrintifyProducts,
  handlePrintifyProductDeleted,
} from "~/lib/printify-sync";
import {
  getPrintifyIfConfigured,
  deletePrintifyProduct,
  publishPrintifyProduct,
  confirmPrintifyPublishingSucceeded,
  listPrintifyWebhooks,
  createPrintifyWebhook,
} from "~/lib/printify";
import { getAdminAuth } from "~/lib/admin-api-auth";

/** Required product webhook topics so Printify can clear "Publishing" when we return 200. */
const REQUIRED_PRODUCT_WEBHOOK_TOPICS = [
  "product:publish:started",
  "product:published",
] as const;

/** Build webhook URL. Prefer request origin (so staging/production use the URL Printify can reach). */
function getExpectedWebhookUrl(request?: NextRequest): string {
  let base = "";
  if (request?.url) {
    try {
      base = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }
  if (!base) base = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
  base = base.replace(/\/$/, "");
  const path = "/api/webhooks/printify";
  const secret = process.env.PRINTIFY_WEBHOOK_SECRET?.trim();
  const qs = secret ? `?secret=${encodeURIComponent(secret)}` : "";
  return base ? `${base}${path}${qs}` : "";
}

/** True if Printify can reach this URL (not localhost). Registration will fail with 9004 otherwise. */
function isWebhookUrlReachableByPrintify(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return false;
  }
}

async function validatePrintifyWebhooks(
  shopId: string,
  request?: NextRequest,
): Promise<{
  ok: boolean;
  expectedUrl: string;
  registered: Array<{ topic: string; url: string }>;
  registeredTopics: string[];
  missingProductTopics: string[];
  message: string;
}> {
  const expectedUrl = getExpectedWebhookUrl(request);
  let registered: Array<{ topic: string; url: string }> = [];
  try {
    const list = await listPrintifyWebhooks(shopId);
    registered = (list ?? []).map((w) => ({ topic: w.topic, url: w.url }));
  } catch {
    return {
      ok: false,
      expectedUrl,
      registered: [],
      registeredTopics: [],
      missingProductTopics: [...REQUIRED_PRODUCT_WEBHOOK_TOPICS],
      message: "Failed to list webhooks (Printify API error).",
    };
  }
  const registeredTopics = registered.map((r) => r.topic);
  const missingProductTopics = REQUIRED_PRODUCT_WEBHOOK_TOPICS.filter(
    (t) => !registeredTopics.includes(t),
  );
  const urlMismatch = registered.length > 0 && registered.some((r) => r.url !== expectedUrl);
  const ok = missingProductTopics.length === 0 && !urlMismatch;
  let message: string;
  if (missingProductTopics.length > 0) {
    message = `Missing webhooks for: ${missingProductTopics.join(", ")}. Register via our app API only: POST /api/admin/printify/webhooks with { "action": "register_all" }. Do not use Printify's front-end—there is no webhook UI there.`;
  } else if (urlMismatch) {
    message = `Webhooks point to different URL(s). Expected: ${expectedUrl}. Update via our app API only: POST /api/admin/printify/webhooks (do not use Printify's front-end).`;
  } else {
    message = "Product webhooks registered; Printify can clear Publishing when we return 200.";
  }
  return {
    ok,
    expectedUrl,
    registered,
    registeredTopics,
    missingProductTopics,
    message,
  };
}

/** Register any missing product webhooks so Printify can clear "Publishing" when we return 200. Returns summary for the response. */
async function ensurePrintifyProductWebhooks(
  shopId: string,
  request?: NextRequest,
): Promise<{
  webhookUrl: string;
  registered: number;
  alreadyRegistered: number;
  failed: number;
  validation: Awaited<ReturnType<typeof validatePrintifyWebhooks>>;
}> {
  const expectedUrl = getExpectedWebhookUrl(request);
  const validation = await validatePrintifyWebhooks(shopId, request);
  let registered = 0;
  let alreadyRegistered = 0;
  let failed = 0;
  let validationMessageOverride: string | null = null;

  const canRegister = expectedUrl && isWebhookUrlReachableByPrintify(expectedUrl);
  if (canRegister) {
    for (const topic of REQUIRED_PRODUCT_WEBHOOK_TOPICS) {
      if (validation.registeredTopics.includes(topic)) {
        alreadyRegistered++;
        continue;
      }
      try {
        await createPrintifyWebhook(shopId, topic, expectedUrl);
        registered++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isValidationFailed =
          msg.includes("9004") ||
          msg.toLowerCase().includes("webhook validation failed");
        if (isValidationFailed) {
          validationMessageOverride =
            "Printify could not validate the webhook URL (code 9004). Ensure NEXT_PUBLIC_APP_URL is a public URL Printify can reach and returns 200 for GET /api/webhooks/printify. Register webhooks via our API only: POST /api/admin/printify/webhooks with { action: 'register_all' } (Printify has no webhook UI).";
        }
        console.warn(`Printify webhook register ${topic} failed:`, err);
        failed++;
      }
    }
  } else if (expectedUrl && validation.missingProductTopics.length > 0) {
    validationMessageOverride =
      "Webhook URL is local or unset (Printify cannot reach it). Set NEXT_PUBLIC_APP_URL to your public URL and register webhooks via our API only: POST /api/admin/printify/webhooks with { action: 'register_all' } (do not use Printify's front-end—there is no webhook UI).";
  }

  const validationAfter =
    expectedUrl && (registered > 0 || failed > 0)
      ? await validatePrintifyWebhooks(shopId, request)
      : validation;
  return {
    webhookUrl: expectedUrl,
    registered,
    alreadyRegistered,
    failed,
    validation: {
      ...validationAfter,
      message:
        validationMessageOverride ?? validationAfter.message,
    },
  };
}

/**
 * POST /api/admin/printify/sync
 *
 * Trigger product synchronization between Printify and local database.
 *
 * Body options:
 * - { action: "import_all" } - Import all products from Printify; then call publish for each so Printify clears "Publishing" (set confirmPublishAfterImport: false to skip)
 * - { action: "import_all", overwrite: true } - Import and overwrite existing
 * - { action: "import_single", printifyProductId: "abc123" } - Import one product by Printify ID (e.g. stuck in "Publishing")
 * - { action: "import_single", productId: "our-id", overwrite: true } - Re-sync one product by our product ID (refreshes Markets)
 * - { action: "confirm_publish", printifyProductId?: "abc", productId?: "our-id" } - Re-call Printify publish API to clear stuck "Publishing" (no body = all local Printify products)
 * - { action: "delete_in_printify", printifyProductId: "abc123" } - Delete product in Printify (unsticks "Publishing"); optional productId to unlink locally
 * - { action: "export_single", productId: "abc" } - Push local changes to Printify
 * - { action: "export_all" } - Push all local changes to Printify
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if Printify is configured
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
    printifyProductId?: string;
    productId?: string;
    overwrite?: boolean;
    visibleOnly?: boolean;
    /** After import_all, call Printify publish for each product so "Publishing" clears (default true). */
    confirmPublishAfterImport?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case "import_all": {
      console.log("Starting Printify import_all sync...");
      // Ensure product webhooks are registered so Printify can clear "Publishing" when we return 200
      const webhooksResult = await ensurePrintifyProductWebhooks(pf.shopId, request);
      const result = await importAllPrintifyProducts({
        visibleOnly: body.visibleOnly ?? true,
        overwriteExisting: body.overwrite ?? false,
      });

      // After import, call publishing_succeeded for each product to clear "Publishing" status.
      // This completes the publish handshake that was previously missing.
      let confirmPublishCount = 0;
      const confirmPublishAfterImport = body.confirmPublishAfterImport !== false;
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      if (confirmPublishAfterImport && result.success) {
        const printifyProducts = await db
          .select({
            id: productsTable.id,
            printifyProductId: productsTable.printifyProductId,
            slug: productsTable.slug,
          })
          .from(productsTable)
          .where(eq(productsTable.source, "printify"));
        const withIds = printifyProducts.filter((p) => p.printifyProductId != null);
        for (const p of withIds) {
          const handle = p.slug ? `/products/${p.slug}` : `/products/${p.id}`;
          const res = await confirmPrintifyPublishingSucceeded(pf.shopId, p.printifyProductId!, {
            id: p.id,
            handle: appUrl ? `${appUrl}${handle}` : handle,
          });
          if (res.success) confirmPublishCount++;
        }
      }

      return NextResponse.json({
        success: result.success,
        summary: {
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
          confirmPublish: confirmPublishAfterImport ? confirmPublishCount : undefined,
        },
        errors: result.errors.slice(0, 20), // Limit errors in response
        webhooks: {
          ok: webhooksResult.validation.ok,
          expectedUrl: webhooksResult.validation.expectedUrl,
          registered: webhooksResult.registered,
          alreadyRegistered: webhooksResult.alreadyRegistered,
          failed: webhooksResult.failed,
          message: webhooksResult.validation.message,
        },
      });
    }

    case "import_single": {
      let printifyProductId = body.printifyProductId;
      if (printifyProductId == null && body.productId) {
        const [row] = await db
          .select({ printifyProductId: productsTable.printifyProductId })
          .from(productsTable)
          .where(eq(productsTable.id, body.productId))
          .limit(1);
        if (!row?.printifyProductId) {
          return NextResponse.json(
            {
              error:
                "Product not found or is not a Printify product. Use printifyProductId for Printify product ID.",
            },
            { status: 400 },
          );
        }
        printifyProductId = row.printifyProductId;
      }
      if (!printifyProductId) {
        return NextResponse.json(
          { error: "printifyProductId or productId required" },
          { status: 400 },
        );
      }

      console.log(`Importing Printify product ${printifyProductId}...`);
      // Ensure product webhooks are registered so Printify can clear "Publishing" when we return 200
      const webhooksResult = await ensurePrintifyProductWebhooks(pf.shopId, request);
      try {
        const result = await importSinglePrintifyProduct(
          printifyProductId,
          body.overwrite ?? false,
        );

        return NextResponse.json({
          success: true,
          action: result.action,
          productId: result.productId,
          webhooks: {
            ok: webhooksResult.validation.ok,
            expectedUrl: webhooksResult.validation.expectedUrl,
            registered: webhooksResult.registered,
            alreadyRegistered: webhooksResult.alreadyRegistered,
            failed: webhooksResult.failed,
            message: webhooksResult.validation.message,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: message },
          { status: 500 },
        );
      }
    }

    case "confirm_publish": {
      // Ensure product webhooks exist, then validate so caller knows if "Publishing" will clear
      const webhooksResult = await ensurePrintifyProductWebhooks(pf.shopId, request);
      const webhooksPayload = {
        ok: webhooksResult.validation.ok,
        expectedUrl: webhooksResult.validation.expectedUrl,
        missingProductTopics: webhooksResult.validation.missingProductTopics,
        message: webhooksResult.validation.message,
        registered: webhooksResult.registered,
        alreadyRegistered: webhooksResult.alreadyRegistered,
        failed: webhooksResult.failed,
      };

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

      // Helper: call publishing_succeeded for a single product
      async function confirmSingleProduct(
        printifyProductId: string,
        localProductId: string,
        slug: string | null,
      ): Promise<{ success: boolean; error?: string }> {
        const handle = slug ? `/products/${slug}` : `/products/${localProductId}`;
        return confirmPrintifyPublishingSucceeded(pf!.shopId, printifyProductId, {
          id: localProductId,
          handle: appUrl ? `${appUrl}${handle}` : handle,
        });
      }

      // Confirm a single product by Printify product ID
      const printifyProductIdParam = body.printifyProductId;
      const productIdParam = body.productId;

      if (printifyProductIdParam) {
        // Look up local product for external id/handle
        const [localProduct] = await db
          .select({ id: productsTable.id, slug: productsTable.slug })
          .from(productsTable)
          .where(eq(productsTable.printifyProductId, printifyProductIdParam))
          .limit(1);
        const localId = localProduct?.id ?? printifyProductIdParam;
        const result = await confirmSingleProduct(printifyProductIdParam, localId, localProduct?.slug ?? null);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error ?? "Printify publishing_succeeded API failed", webhooks: webhooksPayload },
            { status: 400 },
          );
        }
        return NextResponse.json({
          success: true,
          message: "Publishing confirmed via publishing_succeeded for one product. Printify should clear 'Publishing' status.",
          confirmed: 1,
          webhooks: webhooksPayload,
        });
      }

      if (productIdParam) {
        const [row] = await db
          .select({ printifyProductId: productsTable.printifyProductId, slug: productsTable.slug })
          .from(productsTable)
          .where(eq(productsTable.id, productIdParam))
          .limit(1);
        if (!row?.printifyProductId) {
          return NextResponse.json(
            { error: "Product not found or is not a Printify product.", webhooks: webhooksPayload },
            { status: 400 },
          );
        }
        const result = await confirmSingleProduct(row.printifyProductId, productIdParam, row.slug);
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error ?? "Printify publishing_succeeded API failed", webhooks: webhooksPayload },
            { status: 400 },
          );
        }
        return NextResponse.json({
          success: true,
          message: "Publishing confirmed via publishing_succeeded for one product. Printify should clear 'Publishing' status.",
          confirmed: 1,
          webhooks: webhooksPayload,
        });
      }

      // Confirm publish for all local Printify products (stuck "Publishing" → clear via publishing_succeeded)
      const printifyProducts = await db
        .select({
          id: productsTable.id,
          printifyProductId: productsTable.printifyProductId,
          slug: productsTable.slug,
        })
        .from(productsTable)
        .where(eq(productsTable.source, "printify"));

      const withIds = printifyProducts.filter((p) => p.printifyProductId != null);
      const confirmed: number[] = [];
      const errors: string[] = [];

      for (const p of withIds) {
        const res = await confirmSingleProduct(p.printifyProductId!, p.id, p.slug);
        if (res.success) confirmed.push(1);
        else errors.push(`${p.printifyProductId}: ${res.error ?? "unknown"}`);
      }

      return NextResponse.json({
        success: errors.length === 0,
        message:
          confirmed.length > 0
            ? `Publishing confirmed via publishing_succeeded for ${confirmed.length} product(s). Printify should clear 'Publishing' status.`
            : "No Printify products found to confirm.",
        confirmed: confirmed.length,
        total: withIds.length,
        errors: errors.slice(0, 20),
        webhooks: webhooksPayload,
      });
    }

    case "delete_in_printify": {
      let printifyProductIdToDelete = body.printifyProductId;
      if (printifyProductIdToDelete == null && body.productId) {
        const [row] = await db
          .select({ printifyProductId: productsTable.printifyProductId })
          .from(productsTable)
          .where(eq(productsTable.id, body.productId))
          .limit(1);
        if (row?.printifyProductId) {
          printifyProductIdToDelete = row.printifyProductId;
        }
      }
      if (!printifyProductIdToDelete) {
        return NextResponse.json(
          {
            error:
              "printifyProductId or productId required (use Printify product ID for products stuck in Publishing)",
          },
          { status: 400 },
        );
      }

      console.log(
        `Deleting Printify product ${printifyProductIdToDelete} (unstick Publishing)...`,
      );
      const deleteResult = await deletePrintifyProduct(
        pf.shopId,
        printifyProductIdToDelete,
      );
      if (!deleteResult.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              deleteResult.error ??
              "Printify API failed to delete product (may already be deleted or invalid ID)",
          },
          { status: 400 },
        );
      }
      // Unpublish/unlink locally if we have this product
      await handlePrintifyProductDeleted({ id: printifyProductIdToDelete });
      return NextResponse.json({
        success: true,
        message:
          "Product deleted in Printify. Local product unlinked if it existed.",
      });
    }

    case "export_single": {
      if (!body.productId) {
        return NextResponse.json(
          { error: "productId required" },
          { status: 400 },
        );
      }

      console.log(`Exporting product ${body.productId} to Printify...`);
      const result = await exportProductToPrintify(body.productId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        printifyProductId: result.printifyProductId,
      });
    }

    case "export_all": {
      console.log("Starting Printify export_all sync...");
      const result = await exportAllPrintifyProducts();

      return NextResponse.json({
        success: result.success,
        summary: {
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
        },
        errors: result.errors.slice(0, 20),
      });
    }

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: import_all, import_single, confirm_publish, delete_in_printify, export_single, export_all`,
        },
        { status: 400 },
      );
  }
}

/**
 * GET /api/admin/printify/sync
 *
 * Get sync status information.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintifyIfConfigured();
  let webhooks: Awaited<ReturnType<typeof validatePrintifyWebhooks>> | null = null;
  if (pf) {
    webhooks = await validatePrintifyWebhooks(pf.shopId, request);
  }

  return NextResponse.json({
    configured: pf != null,
    shopId: pf?.shopId ?? null,
    webhookUrl: getExpectedWebhookUrl(request),
    webhooks: webhooks
      ? {
          ok: webhooks.ok,
          expectedUrl: webhooks.expectedUrl,
          registered: webhooks.registered,
          missingProductTopics: webhooks.missingProductTopics,
          message: webhooks.message,
        }
      : null,
    documentation: {
      import_all:
        "POST with { action: 'import_all' } - Import all Printify products",
      import_single:
        "POST with { action: 'import_single', printifyProductId: 'abc123' } or { action: 'import_single', productId: 'our-id', overwrite: true }",
      webhooks:
        "GET returns webhooks validation (ok, expectedUrl, missingProductTopics). Register/update webhooks only via our API: POST /api/admin/printify/webhooks with { action: 'register_all' }. Do not use Printify's front-end—there is no webhook UI.",
      confirm_publish:
        "POST with { action: 'confirm_publish' } (all) or printifyProductId/productId to re-call publish API and clear stuck 'Publishing'. Response includes webhooks validation. To register webhooks use POST /api/admin/printify/webhooks with { action: 'register_all' } (only way—Printify has no webhook UI).",
      delete_in_printify:
        "POST with { action: 'delete_in_printify', printifyProductId: 'abc123' } or { productId: 'our-id' } to delete in Printify (unstick Publishing)",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printify",
    },
  });
}
