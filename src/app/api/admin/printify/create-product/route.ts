/**
 * POST /api/admin/printify/create-product
 *
 * Create a product on Printify with design placement and pricing.
 * Optionally publishes the product immediately.
 *
 * Request body:
 * {
 *   title: string,
 *   description: string,
 *   blueprint_id: number,
 *   print_provider_id: number,
 *   image_id: string,              // Printify upload image ID
 *   variants: Array<{ id: number, price: number, is_enabled?: boolean }>,
 *   print_areas: Array<{           // optional — auto-generated if omitted
 *     variant_ids: number[],
 *     placeholders: Array<{
 *       position: string,
 *       images: Array<{ id: string, x: number, y: number, scale: number, angle: number }>
 *     }>
 *   }>,
 *   tags?: string[],
 *   publish?: boolean,             // if true, publish immediately after creation
 * }
 *
 * If print_areas is omitted but image_id is provided, the endpoint auto-generates
 * print areas covering all variant IDs with the image centered on the "front" position.
 *
 * POST /api/admin/printify/create-product?action=publish&productId=<id>
 *   Publish an existing product.
 */

import { type NextRequest, NextResponse } from "next/server";

import {
  createPrintifyProduct,
  publishPrintifyProduct,
  fetchPrintifyVariants,
  getPrintifyIfConfigured,
  type PrintifyCreateProductBody,
} from "~/lib/printify";
import { getAdminAuth } from "~/lib/admin-api-auth";

export async function POST(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pf = getPrintifyIfConfigured();
  if (!pf) {
    return NextResponse.json(
      { error: "Printify not configured." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Publish an existing product
  if (action === "publish") {
    const productId = searchParams.get("productId");
    if (!productId) {
      return NextResponse.json(
        { error: "productId query param required for publish action" },
        { status: 400 },
      );
    }
    try {
      const result = await publishPrintifyProduct(pf.shopId, productId);
      return NextResponse.json({
        action: "publish",
        productId,
        ...result,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Create a new product
  try {
    const body = await request.json();

    const {
      title,
      description,
      blueprint_id,
      print_provider_id,
      image_id,
      tags,
      publish: shouldPublish,
    } = body;

    if (!title || !blueprint_id || !print_provider_id) {
      return NextResponse.json(
        { error: "title, blueprint_id, and print_provider_id are required" },
        { status: 400 },
      );
    }

    // Resolve variants: use provided or fetch all from catalog
    let variants = body.variants;
    if (!variants || variants.length === 0) {
      // Fetch all variants from the catalog
      const catalogVariants = await fetchPrintifyVariants(
        blueprint_id,
        print_provider_id,
      );
      variants = catalogVariants.variants.map(
        (v: { id: number; title: string }) => ({
          id: v.id,
          price: 100, // placeholder, should be overridden
          is_enabled: true,
        }),
      );
    }

    // Build print_areas: use provided or auto-generate from image_id
    let print_areas = body.print_areas;
    if (!print_areas && image_id) {
      const allVariantIds = variants.map(
        (v: { id: number }) => v.id,
      );
      print_areas = [
        {
          variant_ids: allVariantIds,
          placeholders: [
            {
              position: "front",
              images: [
                {
                  id: image_id,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ];
    }

    const createBody: PrintifyCreateProductBody = {
      title,
      description: description || "",
      blueprint_id,
      print_provider_id,
      variants,
      print_areas: print_areas || [],
      tags: tags || [],
    };

    const product = await createPrintifyProduct(pf.shopId, createBody);

    // Optionally publish
    let publishResult = null;
    if (shouldPublish) {
      publishResult = await publishPrintifyProduct(pf.shopId, product.id);
    }

    return NextResponse.json({
      action: "created",
      product_id: product.id,
      title: product.title,
      variants_count: product.variants.length,
      images_count: product.images.length,
      published: shouldPublish ? publishResult : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
