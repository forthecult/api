import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  confirmPrintifyPublishingSucceeded,
  createPrintifyWebhook,
  deletePrintifyProduct,
  getPrintifyIfConfigured,
  listPrintifyWebhooks,
  publishPrintifyProduct,
} from "~/lib/printify";
import {
  exportAllPrintifyProducts,
  exportProductToPrintify,
  handlePrintifyProductDeleted,
  importAllPrintifyProducts,
  importSinglePrintifyProduct,
} from "~/lib/printify-sync";

/** Required product webhook topics so Printify can clear "Publishing" when we return 200. */
const REQUIRED_PRODUCT_WEBHOOK_TOPICS = [
  "product:publish:started",
  "product:deleted",
] as const;

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
  let webhooks: Awaited<ReturnType<typeof validatePrintifyWebhooks>> | null =
    null;
  if (pf) {
    webhooks = await validatePrintifyWebhooks(pf.shopId, request);
  }

  return NextResponse.json({
    configured: pf != null,
    documentation: {
      confirm_publish:
        "POST with { action: 'confirm_publish' } (all) or printifyProductId/productId to re-call publish API and clear stuck 'Publishing'. Response includes webhooks validation. To register webhooks use POST /api/admin/printify/webhooks with { action: 'register_all' } (only way—Printify has no webhook UI).",
      delete_in_printify:
        "POST with { action: 'delete_in_printify', printifyProductId: 'abc123' } or { productId: 'our-id' } to delete in Printify (unstick Publishing)",
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printify",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      import_all:
        "POST with { action: 'import_all' } - Import all Printify products",
      import_single:
        "POST with { action: 'import_single', printifyProductId: 'abc123' } or { action: 'import_single', productId: 'our-id', overwrite: true }",
      webhooks:
        "GET returns webhooks validation (ok, expectedUrl, missingProductTopics). Register/update webhooks only via our API: POST /api/admin/printify/webhooks with { action: 'register_all' }. Do not use Printify's front-end—there is no webhook UI.",
    },
    shopId: pf?.shopId ?? null,
    webhooks: webhooks
      ? {
          expectedUrl: webhooks.expectedUrl,
          message: webhooks.message,
          missingProductTopics: webhooks.missingProductTopics,
          ok: webhooks.ok,
          registered: webhooks.registered,
        }
      : null,
    webhookUrl: getExpectedWebhookUrl(request),
  });
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
    /** After import_all, call Printify publish for each product so "Publishing" clears (default true). */
    confirmPublishAfterImport?: boolean;
    overwrite?: boolean;
    printifyProductId?: string;
    productId?: string;
    visibleOnly?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
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
            error:
              deleteResult.error ??
              "Printify API failed to delete product (may already be deleted or invalid ID)",
            success: false,
          },
          { status: 400 },
        );
      }
      // Unpublish/unlink locally if we have this product
      await handlePrintifyProductDeleted({ id: printifyProductIdToDelete });
      return NextResponse.json({
        message:
          "Product deleted in Printify. Local product unlinked if it existed.",
        success: true,
      });
    }

    case "export_all": {
      console.log("Starting Printify export_all sync...");
      const result = await exportAllPrintifyProducts();

      return NextResponse.json({
        errors: result.errors.slice(0, 20),
        success: result.success,
        summary: {
          errors: result.errors.length,
          skipped: result.skipped,
          updated: result.updated,
        },
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
          { error: result.error, success: false },
          { status: 400 },
        );
      }

      return NextResponse.json({
        printifyProductId: result.printifyProductId,
        success: true,
      });
    }

    case "import_all": {
      console.log("Starting Printify import_all sync...");
      // Ensure product webhooks are registered so Printify can clear "Publishing" when we return 200
      const webhooksResult = await ensurePrintifyProductWebhooks(
        pf.shopId,
        request,
      );
      const result = await importAllPrintifyProducts({
        overwriteExisting: body.overwrite ?? false,
        visibleOnly: body.visibleOnly ?? true,
      });

      // After import, call publishing_succeeded for each product to clear "Publishing" status.
      // This completes the publish handshake that was previously missing.
      let confirmPublishCount = 0;
      const confirmPublishAfterImport =
        body.confirmPublishAfterImport !== false;
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
        const withIds = printifyProducts.filter(
          (p) => p.printifyProductId != null,
        );
        for (const p of withIds) {
          const handle = p.slug ? `/products/${p.slug}` : `/products/${p.id}`;
          const res = await confirmPrintifyPublishingSucceeded(
            pf.shopId,
            p.printifyProductId!,
            {
              handle: appUrl ? `${appUrl}${handle}` : handle,
              id: p.id,
            },
          );
          if (res.success) confirmPublishCount++;
        }
      }

      return NextResponse.json({
        errors: result.errors.slice(0, 20), // Limit errors in response
        success: result.success,
        summary: {
          confirmPublish: confirmPublishAfterImport
            ? confirmPublishCount
            : undefined,
          errors: result.errors.length,
          imported: result.imported,
          skipped: result.skipped,
          updated: result.updated,
        },
        webhooks: {
          alreadyRegistered: webhooksResult.alreadyRegistered,
          expectedUrl: webhooksResult.validation.expectedUrl,
          failed: webhooksResult.failed,
          message: webhooksResult.validation.message,
          ok: webhooksResult.validation.ok,
          registered: webhooksResult.registered,
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
      const webhooksResult = await ensurePrintifyProductWebhooks(
        pf.shopId,
        request,
      );
      try {
        const result = await importSinglePrintifyProduct(
          printifyProductId,
          body.overwrite ?? false,
        );

        return NextResponse.json({
          action: result.action,
          productId: result.productId,
          success: true,
          webhooks: {
            alreadyRegistered: webhooksResult.alreadyRegistered,
            expectedUrl: webhooksResult.validation.expectedUrl,
            failed: webhooksResult.failed,
            message: webhooksResult.validation.message,
            ok: webhooksResult.validation.ok,
            registered: webhooksResult.registered,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: message, success: false },
          { status: 500 },
        );
      }
    }

    case "confirm_publish": {
      // Ensure product webhooks exist, then validate so caller knows if "Publishing" will clear
      const webhooksResult = await ensurePrintifyProductWebhooks(
        pf.shopId,
        request,
      );
      const webhooksPayload = {
        alreadyRegistered: webhooksResult.alreadyRegistered,
        expectedUrl: webhooksResult.validation.expectedUrl,
        failed: webhooksResult.failed,
        message: webhooksResult.validation.message,
        missingProductTopics: webhooksResult.validation.missingProductTopics,
        ok: webhooksResult.validation.ok,
        registered: webhooksResult.registered,
      };

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

      // Helper: call publishing_succeeded for a single product
      async function confirmSingleProduct(
        printifyProductId: string,
        localProductId: string,
        slug: null | string,
      ): Promise<{ error?: string; success: boolean }> {
        const handle = slug
          ? `/products/${slug}`
          : `/products/${localProductId}`;
        return confirmPrintifyPublishingSucceeded(
          pf!.shopId,
          printifyProductId,
          {
            handle: appUrl ? `${appUrl}${handle}` : handle,
            id: localProductId,
          },
        );
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
        const result = await confirmSingleProduct(
          printifyProductIdParam,
          localId,
          localProduct?.slug ?? null,
        );
        if (!result.success) {
          return NextResponse.json(
            {
              error: result.error ?? "Printify publishing_succeeded API failed",
              success: false,
              webhooks: webhooksPayload,
            },
            { status: 400 },
          );
        }
        return NextResponse.json({
          confirmed: 1,
          message:
            "Publishing confirmed via publishing_succeeded for one product. Printify should clear 'Publishing' status.",
          success: true,
          webhooks: webhooksPayload,
        });
      }

      if (productIdParam) {
        const [row] = await db
          .select({
            printifyProductId: productsTable.printifyProductId,
            slug: productsTable.slug,
          })
          .from(productsTable)
          .where(eq(productsTable.id, productIdParam))
          .limit(1);
        if (!row?.printifyProductId) {
          return NextResponse.json(
            {
              error: "Product not found or is not a Printify product.",
              webhooks: webhooksPayload,
            },
            { status: 400 },
          );
        }
        const result = await confirmSingleProduct(
          row.printifyProductId,
          productIdParam,
          row.slug,
        );
        if (!result.success) {
          return NextResponse.json(
            {
              error: result.error ?? "Printify publishing_succeeded API failed",
              success: false,
              webhooks: webhooksPayload,
            },
            { status: 400 },
          );
        }
        return NextResponse.json({
          confirmed: 1,
          message:
            "Publishing confirmed via publishing_succeeded for one product. Printify should clear 'Publishing' status.",
          success: true,
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

      const withIds = printifyProducts.filter(
        (p) => p.printifyProductId != null,
      );
      const confirmed: number[] = [];
      const errors: string[] = [];

      for (const p of withIds) {
        const res = await confirmSingleProduct(
          p.printifyProductId!,
          p.id,
          p.slug,
        );
        if (res.success) confirmed.push(1);
        else errors.push(`${p.printifyProductId}: ${res.error ?? "unknown"}`);
      }

      return NextResponse.json({
        confirmed: confirmed.length,
        errors: errors.slice(0, 20),
        message:
          confirmed.length > 0
            ? `Publishing confirmed via publishing_succeeded for ${confirmed.length} product(s). Printify should clear 'Publishing' status.`
            : "No Printify products found to confirm.",
        success: errors.length === 0,
        total: withIds.length,
        webhooks: webhooksPayload,
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

/** Register any missing product webhooks so Printify can clear "Publishing" when we return 200. Returns summary for the response. */
async function ensurePrintifyProductWebhooks(
  shopId: string,
  request?: NextRequest,
): Promise<{
  alreadyRegistered: number;
  failed: number;
  registered: number;
  validation: Awaited<ReturnType<typeof validatePrintifyWebhooks>>;
  webhookUrl: string;
}> {
  const expectedUrl = getExpectedWebhookUrl(request);
  const validation = await validatePrintifyWebhooks(shopId, request);
  let registered = 0;
  let alreadyRegistered = 0;
  let failed = 0;
  let validationMessageOverride: null | string = null;

  const canRegister =
    expectedUrl && isWebhookUrlReachableByPrintify(expectedUrl);
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
    alreadyRegistered,
    failed,
    registered,
    validation: {
      ...validationAfter,
      message: validationMessageOverride ?? validationAfter.message,
    },
    webhookUrl: expectedUrl,
  };
}

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
    return (
      host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

async function validatePrintifyWebhooks(
  shopId: string,
  request?: NextRequest,
): Promise<{
  expectedUrl: string;
  message: string;
  missingProductTopics: string[];
  ok: boolean;
  registered: { topic: string; url: string }[];
  registeredTopics: string[];
}> {
  const expectedUrl = getExpectedWebhookUrl(request);
  let registered: { topic: string; url: string }[] = [];
  try {
    const list = await listPrintifyWebhooks(shopId);
    registered = (list ?? []).map((w) => ({ topic: w.topic, url: w.url }));
  } catch {
    return {
      expectedUrl,
      message: "Failed to list webhooks (Printify API error).",
      missingProductTopics: [...REQUIRED_PRODUCT_WEBHOOK_TOPICS],
      ok: false,
      registered: [],
      registeredTopics: [],
    };
  }
  const registeredTopics = registered.map((r) => r.topic);
  const missingProductTopics = REQUIRED_PRODUCT_WEBHOOK_TOPICS.filter(
    (t) => !registeredTopics.includes(t),
  );
  const urlMismatch =
    registered.length > 0 && registered.some((r) => r.url !== expectedUrl);
  const ok = missingProductTopics.length === 0 && !urlMismatch;
  let message: string;
  if (missingProductTopics.length > 0) {
    message = `Missing webhooks for: ${missingProductTopics.join(", ")}. Register via our app API only: POST /api/admin/printify/webhooks with { "action": "register_all" }. Do not use Printify's front-end—there is no webhook UI there.`;
  } else if (urlMismatch) {
    message = `Webhooks point to different URL(s). Expected: ${expectedUrl}. Update via our app API only: POST /api/admin/printify/webhooks (do not use Printify's front-end).`;
  } else {
    message =
      "Product webhooks registered; Printify can clear Publishing when we return 200.";
  }
  return {
    expectedUrl,
    message,
    missingProductTopics,
    ok,
    registered,
    registeredTopics,
  };
}
