import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { getPrintfulIfConfigured } from "~/lib/printful";
import {
  exportAllPrintfulProducts,
  exportProductToPrintful,
  fixSizeChartDisplayNames,
  importAllPrintfulProducts,
  importSinglePrintfulProduct,
  importSizeChartForPrintfulProduct,
  importSizeChartsForAllPrintfulProducts,
} from "~/lib/printful-sync";

/**
 * GET /api/admin/printful/sync
 *
 * Get sync status information.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const pf = getPrintfulIfConfigured();

  return NextResponse.json({
    configured: pf != null,
    documentation: {
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printful",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      fix_size_chart_names:
        "POST with { action: 'fix_size_chart_names' } - Fix miscapitalized display names (e.g. HOodies → Hoodies)",
      import_all:
        "POST with { action: 'import_all' } - Import all Printful products",
      import_single:
        "POST with { action: 'import_single', printfulSyncProductId: 123 } or { action: 'import_single', productId: 'our-id', overwrite: true }",
      import_size_charts:
        "POST with { action: 'import_size_charts' } - Backfill size charts for all Printful products",
    },
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`,
  });
}

/**
 * POST /api/admin/printful/sync
 *
 * Trigger product synchronization between Printful and local database.
 *
 * Body options:
 * - { action: "import_all" } - Import all sync products from Printful
 * - { action: "import_all", overwrite: true } - Import and overwrite existing
 * - { action: "import_single", printfulSyncProductId: 123 } - Import one product by Printful sync ID
 * - { action: "import_single", productId: "abc", overwrite: true } - Re-sync one product by our product ID (refreshes Markets)
 * - { action: "export_single", productId: "abc" } - Push local changes to Printful
 * - { action: "export_all" } - Push all local changes to Printful
 * - { action: "import_size_charts" } - Backfill size charts for all Printful products (by brand/model)
 */
export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  // Check if Printful is configured
  const pf = getPrintfulIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printful not configured. Set PRINTFUL_API_TOKEN." },
      { status: 400 },
    );
  }

  let body: {
    action: string;
    overwrite?: boolean;
    printfulSyncProductId?: number;
    productId?: string;
    syncedOnly?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case "export_all": {
      console.log("Starting Printful export_all sync...");
      const result = await exportAllPrintfulProducts();

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

    case "fix_size_chart_names": {
      console.log("Fixing size chart display names...");
      const result = await fixSizeChartDisplayNames();
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    case "import_all": {
      console.log("Starting Printful import_all sync...");
      const result = await importAllPrintfulProducts({
        overwriteExisting: body.overwrite ?? false,
        syncedOnly: body.syncedOnly ?? true,
      });

      // Always backfill size charts for all Printful products in DB (by brand/model).
      // So size charts are imported even when sync returns 0/0/0 or products were skipped.
      const sizeChartsResult =
        await importSizeChartsForAllPrintfulProducts().catch((err) => ({
          errors: [err instanceof Error ? err.message : String(err)],
          success: false as const,
          upserted: 0,
        }));

      return NextResponse.json({
        errors: result.errors.slice(0, 20), // Limit errors in response
        sizeCharts: {
          errors: sizeChartsResult.errors.slice(0, 10),
          success: sizeChartsResult.success,
          upserted: sizeChartsResult.upserted,
        },
        success: result.success,
        summary: {
          errors: result.errors.length,
          imported: result.imported,
          skipped: result.skipped,
          updated: result.updated,
        },
      });
    }

    case "import_single": {
      let printfulSyncProductId = body.printfulSyncProductId;
      const productIdRaw =
        body.productId != null ? String(body.productId) : null;
      if (printfulSyncProductId == null && productIdRaw) {
        const [row] = await db
          .select({
            printfulSyncProductId: productsTable.printfulSyncProductId,
          })
          .from(productsTable)
          .where(eq(productsTable.id, productIdRaw))
          .limit(1);
        if (!row?.printfulSyncProductId) {
          return NextResponse.json(
            {
              error:
                "Product not found or is not a Printful product. Use printfulSyncProductId for Printful sync product ID.",
            },
            { status: 400 },
          );
        }
        printfulSyncProductId = row.printfulSyncProductId;
      }
      if (printfulSyncProductId == null) {
        return NextResponse.json(
          { error: "printfulSyncProductId or productId required" },
          { status: 400 },
        );
      }

      console.log(`Importing Printful product ${printfulSyncProductId}...`);
      try {
        const result = await importSinglePrintfulProduct(
          printfulSyncProductId,
          body.overwrite ?? false,
        );

        // Always try to import size chart after single-product sync (uses DB brand/model/externalId)
        const sizeChartResult = await importSizeChartForPrintfulProduct(
          result.productId,
        ).catch((err) => ({
          error: err instanceof Error ? err.message : String(err),
          success: false as const,
        }));
        if (!sizeChartResult.success && sizeChartResult.error) {
          console.warn(
            "Printful single-product sync: size chart import failed",
            result.productId,
            sizeChartResult.error,
          );
        }

        return NextResponse.json({
          action: result.action,
          productId: result.productId,
          sizeChartImported: sizeChartResult.success,
          success: true,
          ...(sizeChartResult.success
            ? {}
            : { sizeChartError: sizeChartResult.error }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { error: message, success: false },
          { status: 500 },
        );
      }
    }

    case "export_single": {
      if (!body.productId) {
        return NextResponse.json(
          { error: "productId required" },
          { status: 400 },
        );
      }

      console.log(`Exporting product ${body.productId} to Printful...`);
      const result = await exportProductToPrintful(body.productId);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error, success: false },
          { status: 400 },
        );
      }

      return NextResponse.json({
        printfulSyncProductId: result.printfulSyncProductId,
        success: true,
      });
    }

    case "import_size_charts": {
      console.log("Starting Printful size charts backfill...");
      const result = await importSizeChartsForAllPrintfulProducts();
      return NextResponse.json({
        errors: result.errors.slice(0, 30),
        success: result.success,
        upserted: result.upserted,
      });
    }

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: import_all, import_single, import_size_charts, fix_size_chart_names, export_single, export_all`,
        },
        { status: 400 },
      );
  }
}
