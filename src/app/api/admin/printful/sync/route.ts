import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productsTable } from "~/db/schema";
import {
  importAllPrintfulProducts,
  importSinglePrintfulProduct,
  importSizeChartForPrintfulProduct,
  importSizeChartsForAllPrintfulProducts,
  fixSizeChartDisplayNames,
  exportProductToPrintful,
  exportAllPrintfulProducts,
} from "~/lib/printful-sync";
import { getPrintfulIfConfigured } from "~/lib/printful";
import { getAdminAuth } from "~/lib/admin-api-auth";

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
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    printfulSyncProductId?: number;
    productId?: string;
    overwrite?: boolean;
    syncedOnly?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case "import_all": {
      console.log("Starting Printful import_all sync...");
      const result = await importAllPrintfulProducts({
        syncedOnly: body.syncedOnly ?? true,
        overwriteExisting: body.overwrite ?? false,
      });

      // Always backfill size charts for all Printful products in DB (by brand/model).
      // So size charts are imported even when sync returns 0/0/0 or products were skipped.
      const sizeChartsResult =
        await importSizeChartsForAllPrintfulProducts().catch((err) => ({
          success: false as const,
          upserted: 0,
          errors: [err instanceof Error ? err.message : String(err)],
        }));

      return NextResponse.json({
        success: result.success,
        summary: {
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
        },
        errors: result.errors.slice(0, 20), // Limit errors in response
        sizeCharts: {
          upserted: sizeChartsResult.upserted,
          success: sizeChartsResult.success,
          errors: sizeChartsResult.errors.slice(0, 10),
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
          success: false as const,
          error: err instanceof Error ? err.message : String(err),
        }));
        if (!sizeChartResult.success && sizeChartResult.error) {
          console.warn(
            "Printful single-product sync: size chart import failed",
            result.productId,
            sizeChartResult.error,
          );
        }

        return NextResponse.json({
          success: true,
          action: result.action,
          productId: result.productId,
          sizeChartImported: sizeChartResult.success,
          ...(sizeChartResult.success
            ? {}
            : { sizeChartError: sizeChartResult.error }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { success: false, error: message },
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
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        printfulSyncProductId: result.printfulSyncProductId,
      });
    }

    case "export_all": {
      console.log("Starting Printful export_all sync...");
      const result = await exportAllPrintfulProducts();

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

    case "import_size_charts": {
      console.log("Starting Printful size charts backfill...");
      const result = await importSizeChartsForAllPrintfulProducts();
      return NextResponse.json({
        success: result.success,
        upserted: result.upserted,
        errors: result.errors.slice(0, 30),
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

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: import_all, import_single, import_size_charts, fix_size_chart_names, export_single, export_all`,
        },
        { status: 400 },
      );
  }
}

/**
 * GET /api/admin/printful/sync
 *
 * Get sync status information.
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintfulIfConfigured();

  return NextResponse.json({
    configured: pf != null,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`,
    documentation: {
      import_all:
        "POST with { action: 'import_all' } - Import all Printful products",
      import_single:
        "POST with { action: 'import_single', printfulSyncProductId: 123 } or { action: 'import_single', productId: 'our-id', overwrite: true }",
      import_size_charts:
        "POST with { action: 'import_size_charts' } - Backfill size charts for all Printful products",
      fix_size_chart_names:
        "POST with { action: 'fix_size_chart_names' } - Fix miscapitalized display names (e.g. HOodies → Hoodies)",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printful",
    },
  });
}
