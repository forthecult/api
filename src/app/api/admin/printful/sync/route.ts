import { type NextRequest, NextResponse } from "next/server";

import {
  importAllPrintfulProducts,
  importSinglePrintfulProduct,
  exportProductToPrintful,
  exportAllPrintfulProducts,
} from "~/lib/printful-sync";
import { getPrintfulIfConfigured } from "~/lib/printful";
import { auth, isAdminUser } from "~/lib/auth";

/**
 * POST /api/admin/printful/sync
 *
 * Trigger product synchronization between Printful and local database.
 *
 * Body options:
 * - { action: "import_all" } - Import all sync products from Printful
 * - { action: "import_all", overwrite: true } - Import and overwrite existing
 * - { action: "import_single", printfulSyncProductId: 123 } - Import one product
 * - { action: "export_single", productId: "abc" } - Push local changes to Printful
 * - { action: "export_all" } - Push all local changes to Printful
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

      return NextResponse.json({
        success: result.success,
        summary: {
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          errors: result.errors.length,
        },
        errors: result.errors.slice(0, 20), // Limit errors in response
      });
    }

    case "import_single": {
      if (!body.printfulSyncProductId) {
        return NextResponse.json(
          { error: "printfulSyncProductId required" },
          { status: 400 },
        );
      }

      console.log(
        `Importing Printful product ${body.printfulSyncProductId}...`,
      );
      try {
        const result = await importSinglePrintfulProduct(
          body.printfulSyncProductId,
          body.overwrite ?? false,
        );

        return NextResponse.json({
          success: true,
          action: result.action,
          productId: result.productId,
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

    default:
      return NextResponse.json(
        {
          error: `Unknown action: ${action}. Valid: import_all, import_single, export_single, export_all`,
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
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pf = getPrintfulIfConfigured();

  return NextResponse.json({
    configured: pf != null,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printful`,
    documentation: {
      import_all:
        "POST with { action: 'import_all' } - Import all Printful products",
      import_single:
        "POST with { action: 'import_single', printfulSyncProductId: 123 }",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printful",
    },
  });
}
