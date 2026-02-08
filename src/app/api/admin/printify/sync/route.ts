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
} from "~/lib/printify";
import { auth, isAdminUser } from "~/lib/auth";

/**
 * POST /api/admin/printify/sync
 *
 * Trigger product synchronization between Printify and local database.
 *
 * Body options:
 * - { action: "import_all" } - Import all products from Printify
 * - { action: "import_all", overwrite: true } - Import and overwrite existing
 * - { action: "import_single", printifyProductId: "abc123" } - Import one product by Printify ID (e.g. stuck in "Publishing")
 * - { action: "import_single", productId: "our-id", overwrite: true } - Re-sync one product by our product ID (refreshes Markets)
 * - { action: "delete_in_printify", printifyProductId: "abc123" } - Delete product in Printify (unsticks "Publishing"); optional productId to unlink locally
 * - { action: "export_single", productId: "abc" } - Push local changes to Printify
 * - { action: "export_all" } - Push all local changes to Printify
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      const result = await importAllPrintifyProducts({
        visibleOnly: body.visibleOnly ?? true,
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
      try {
        const result = await importSinglePrintifyProduct(
          printifyProductId,
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
          error: `Unknown action: ${action}. Valid: import_all, import_single, delete_in_printify, export_single, export_all`,
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
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminUser(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pf = getPrintifyIfConfigured();

  return NextResponse.json({
    configured: pf != null,
    shopId: pf?.shopId ?? null,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/printify`,
    documentation: {
      import_all:
        "POST with { action: 'import_all' } - Import all Printify products",
      import_single:
        "POST with { action: 'import_single', printifyProductId: 'abc123' } or { action: 'import_single', productId: 'our-id', overwrite: true }",
      delete_in_printify:
        "POST with { action: 'delete_in_printify', printifyProductId: 'abc123' } or { productId: 'our-id' } to delete in Printify (unstick Publishing)",
      export_single: "POST with { action: 'export_single', productId: 'abc' }",
      export_all:
        "POST with { action: 'export_all' } - Push prices to Printify",
    },
  });
}
