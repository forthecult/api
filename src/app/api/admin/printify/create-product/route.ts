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

import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  createPrintifyProduct,
  fetchPrintifyVariants,
  getPrintifyIfConfigured,
  type PrintifyCreateProductBody,
  publishPrintifyProduct,
} from "~/lib/printify";

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
    const body = (await request.json()) as {
      blueprint_id?: number;
      description?: string;
      image_id?: string;
      print_provider_id?: number;
      publish?: boolean;
      print_areas?: unknown;
      tags?: string[];
      title?: string;
      variants?: Array<{ id: number; is_enabled?: boolean; price: number }>;
    };

    const {
      blueprint_id,
      description,
      image_id,
      print_provider_id,
      publish: shouldPublish,
      tags,
      title,
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
          is_enabled: true,
          price: 100, // placeholder, should be overridden
        }),
      );
    }

    // Build print_areas: use provided or auto-generate from image_id
    let print_areas: PrintifyCreateProductBody["print_areas"] | undefined =
      Array.isArray(body.print_areas) && body.print_areas.length > 0
        ? (body.print_areas as PrintifyCreateProductBody["print_areas"])
        : undefined;
    if (!print_areas && image_id) {
      const allVariantIds = variants.map((v: { id: number }) => v.id);
      print_areas = [
        {
          placeholders: [
            {
              images: [
                {
                  angle: 0,
                  id: image_id,
                  scale: 1,
                  x: 0.5,
                  y: 0.5,
                },
              ],
              position: "front",
            },
          ],
          variant_ids: allVariantIds,
        },
      ];
    }

    const createBody: PrintifyCreateProductBody = {
      blueprint_id,
      description: description || "",
      print_areas: print_areas ?? [],
      print_provider_id,
      tags: tags || [],
      title,
      variants,
    };

    const product = await createPrintifyProduct(pf.shopId, createBody);

    // Optionally publish
    let publishResult = null;
    if (shouldPublish) {
      publishResult = await publishPrintifyProduct(pf.shopId, product.id);
    }

    return NextResponse.json({
      action: "created",
      images_count: product.images.length,
      product_id: product.id,
      published: shouldPublish ? publishResult : null,
      title: product.title,
      variants_count: product.variants.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
