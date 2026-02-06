import { and, asc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "~/db";
import {
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productTokenGateTable,
  productsTable,
  productTagsTable,
  productVariantsTable,
} from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import { syncProductCategoriesWithAutoRules } from "~/lib/category-auto-assign";
import { exportProductToPrintful } from "~/lib/printful-sync";
import { exportProductToPrintify } from "~/lib/printify-sync";

/** Generate URL-safe slug from name when slug is empty. */
function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/** Resolve route param (id or slug) to a product; returns product or null. */
async function getProductByParam(param: string) {
  const [byId] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, param))
    .limit(1);
  if (byId) return byId;
  const [bySlug] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.slug, param))
    .limit(1);
  return bySlug ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: param } = await params;
    const product = await getProductByParam(param);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const productId = product.id;

    const [mainPc, images, tags, variants, availableCountries, tokenGatesRows] =
      await Promise.all([
        db
          .select({ categoryId: productCategoriesTable.categoryId })
          .from(productCategoriesTable)
          .where(
            and(
              eq(productCategoriesTable.productId, productId),
              eq(productCategoriesTable.isMain, true),
            ),
          )
          .limit(1),
        db
          .select()
          .from(productImagesTable)
          .where(eq(productImagesTable.productId, productId))
          .orderBy(
            asc(productImagesTable.sortOrder),
            asc(productImagesTable.id),
          ),
        db
          .select({ tag: productTagsTable.tag })
          .from(productTagsTable)
          .where(eq(productTagsTable.productId, productId)),
        db
          .select()
          .from(productVariantsTable)
          .where(eq(productVariantsTable.productId, productId)),
        db
          .select({ countryCode: productAvailableCountryTable.countryCode })
          .from(productAvailableCountryTable)
          .where(eq(productAvailableCountryTable.productId, productId))
          .catch(() => [] as { countryCode: string }[]),
        db
          .select({
            id: productTokenGateTable.id,
            tokenSymbol: productTokenGateTable.tokenSymbol,
            quantity: productTokenGateTable.quantity,
            network: productTokenGateTable.network,
            contractAddress: productTokenGateTable.contractAddress,
          })
          .from(productTokenGateTable)
          .where(eq(productTokenGateTable.productId, productId)),
      ]);

    const slug = product.slug?.trim() || slugFromName(product.name) || null;

    const tokenGates = tokenGatesRows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    let features: string[] = [];
    if (product.featuresJson) {
      try {
        const parsed = JSON.parse(product.featuresJson) as unknown;
        if (Array.isArray(parsed)) {
          features = parsed.filter(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          );
        }
      } catch {
        // ignore invalid JSON
      }
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      description: product.description,
      features,
      imageUrl: product.imageUrl,
      mainImageAlt: product.mainImageAlt ?? null,
      mainImageTitle: product.mainImageTitle ?? null,
      metaDescription: product.metaDescription,
      pageTitle: product.pageTitle,
      priceCents: product.priceCents,
      compareAtPriceCents: product.compareAtPriceCents,
      costPerItemCents: product.costPerItemCents,
      published: product.published,
      brand: product.brand,
      vendor: product.vendor,
      slug,
      sku: product.sku,
      barcode: product.barcode,
      weightGrams: product.weightGrams,
      weightUnit: product.weightUnit,
      physicalProduct: product.physicalProduct,
      trackQuantity: product.trackQuantity,
      continueSellingWhenOutOfStock: product.continueSellingWhenOutOfStock,
      quantity: product.quantity,
      hsCode: product.hsCode,
      countryOfOrigin: product.countryOfOrigin,
      shipsFromDisplay: product.shipsFromDisplay ?? null,
      shipsFromCountry: product.shipsFromCountry ?? null,
      shipsFromRegion: product.shipsFromRegion ?? null,
      shipsFromCity: product.shipsFromCity ?? null,
      shipsFromPostalCode: product.shipsFromPostalCode ?? null,
      hasVariants: product.hasVariants,
      optionDefinitionsJson: product.optionDefinitionsJson,
      tokenGated: tokenGates.length > 0 || product.tokenGated,
      tokenGateType: product.tokenGateType,
      tokenGateQuantity: product.tokenGateQuantity,
      tokenGateNetwork: product.tokenGateNetwork,
      tokenGateContractAddress: product.tokenGateContractAddress,
      tokenGates,
      categoryId: mainPc[0]?.categoryId ?? null,
      availableCountryCodes: availableCountries.map((r) => r.countryCode),
      images: images.map((img) => ({
        id: img.id,
        url: img.url,
        alt: img.alt,
        title: img.title,
        sortOrder: img.sortOrder,
      })),
      tags: tags.map((t) => t.tag),
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        sku: v.sku,
        label: v.label ?? null,
        stockQuantity: v.stockQuantity,
        priceCents: v.priceCents,
        imageUrl: v.imageUrl,
        imageAlt: v.imageAlt ?? null,
        imageTitle: v.imageTitle ?? null,
        availabilityStatus: v.availabilityStatus ?? null,
      })),
    });
  } catch (err) {
    console.error("Admin product get error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load product";
    return NextResponse.json(
      {
        error: "Failed to load product",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: param } = await params;
    const existing = await getProductByParam(param);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const id = existing.id;
    const body = (await request.json()) as {
      published?: boolean;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      mainImageAlt?: string | null;
      mainImageTitle?: string | null;
      metaDescription?: string | null;
      pageTitle?: string | null;
      priceCents?: number;
      compareAtPriceCents?: number | null;
      costPerItemCents?: number | null;
      brand?: string | null;
      vendor?: string | null;
      slug?: string | null;
      sku?: string | null;
      barcode?: string | null;
      weightGrams?: number | null;
      weightUnit?: string | null;
      physicalProduct?: boolean;
      trackQuantity?: boolean;
      continueSellingWhenOutOfStock?: boolean;
      quantity?: number | null;
      hsCode?: string | null;
      countryOfOrigin?: string | null;
      shipsFromDisplay?: string | null;
      shipsFromCountry?: string | null;
      shipsFromRegion?: string | null;
      shipsFromCity?: string | null;
      shipsFromPostalCode?: string | null;
      hasVariants?: boolean;
      optionDefinitionsJson?: string | null;
      tokenGated?: boolean;
      tokenGateType?: string | null;
      tokenGateQuantity?: number | null;
      tokenGateNetwork?: string | null;
      tokenGateContractAddress?: string | null;
      categoryId?: string | null;
      images?: Array<{
        id?: string;
        url: string;
        alt?: string | null;
        title?: string | null;
        sortOrder?: number;
      }>;
      tags?: string[];
      variants?: Array<{
        id?: string;
        size?: string | null;
        color?: string | null;
        sku?: string | null;
        label?: string | null;
        stockQuantity?: number | null;
        priceCents: number;
        imageUrl?: string | null;
        imageAlt?: string | null;
        imageTitle?: string | null;
      }>;
      availableCountryCodes?: string[];
      tokenGates?: Array<{
        id?: string;
        tokenSymbol: string;
        quantity: number;
        network?: string | null;
        contractAddress?: string | null;
      }>;
      features?: string[];
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.published === "boolean") updates.published = body.published;
    if (typeof body.name === "string") updates.name = body.name;
    if (body.description !== undefined)
      updates.description = body.description ?? null;
    if (body.features !== undefined) {
      const arr = Array.isArray(body.features)
        ? body.features.filter(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          )
        : [];
      updates.featuresJson =
        arr.length > 0 ? JSON.stringify(arr) : null;
    }
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl ?? null;
    if (body.mainImageAlt !== undefined)
      updates.mainImageAlt = body.mainImageAlt?.trim() ?? null;
    if (body.mainImageTitle !== undefined)
      updates.mainImageTitle = body.mainImageTitle?.trim() ?? null;
    if (body.metaDescription !== undefined)
      updates.metaDescription = body.metaDescription ?? null;
    if (body.pageTitle !== undefined)
      updates.pageTitle = body.pageTitle ?? null;
    if (typeof body.priceCents === "number")
      updates.priceCents = body.priceCents;
    if (body.compareAtPriceCents !== undefined)
      updates.compareAtPriceCents = body.compareAtPriceCents ?? null;
    if (body.costPerItemCents !== undefined)
      updates.costPerItemCents = body.costPerItemCents ?? null;
    if (body.brand !== undefined) updates.brand = body.brand ?? null;
    if (body.vendor !== undefined) updates.vendor = body.vendor ?? null;
    if (body.slug !== undefined) updates.slug = body.slug?.trim() || null;
    if (body.sku !== undefined) updates.sku = body.sku?.trim() || null;
    if (body.barcode !== undefined)
      updates.barcode = body.barcode?.trim() || null;
    if (body.weightGrams !== undefined)
      updates.weightGrams = body.weightGrams ?? null;
    if (body.weightUnit !== undefined)
      updates.weightUnit = body.weightUnit ?? null;
    if (typeof body.physicalProduct === "boolean")
      updates.physicalProduct = body.physicalProduct;
    if (typeof body.trackQuantity === "boolean")
      updates.trackQuantity = body.trackQuantity;
    if (typeof body.continueSellingWhenOutOfStock === "boolean")
      updates.continueSellingWhenOutOfStock =
        body.continueSellingWhenOutOfStock;
    if (body.quantity !== undefined) updates.quantity = body.quantity ?? null;
    if (body.hsCode !== undefined) updates.hsCode = body.hsCode?.trim() || null;
    if (body.countryOfOrigin !== undefined)
      updates.countryOfOrigin = body.countryOfOrigin?.trim() || null;
    if (body.shipsFromDisplay !== undefined)
      updates.shipsFromDisplay = body.shipsFromDisplay?.trim() || null;
    if (body.shipsFromCountry !== undefined)
      updates.shipsFromCountry = body.shipsFromCountry?.trim() || null;
    if (body.shipsFromRegion !== undefined)
      updates.shipsFromRegion = body.shipsFromRegion?.trim() || null;
    if (body.shipsFromCity !== undefined)
      updates.shipsFromCity = body.shipsFromCity?.trim() || null;
    if (body.shipsFromPostalCode !== undefined)
      updates.shipsFromPostalCode = body.shipsFromPostalCode?.trim() || null;
    if (typeof body.hasVariants === "boolean")
      updates.hasVariants = body.hasVariants;
    if (body.optionDefinitionsJson !== undefined)
      updates.optionDefinitionsJson = body.optionDefinitionsJson ?? null;
    if (typeof body.tokenGated === "boolean")
      updates.tokenGated = body.tokenGated;
    if (body.tokenGateType !== undefined)
      updates.tokenGateType = body.tokenGateType ?? null;
    if (body.tokenGateQuantity !== undefined)
      updates.tokenGateQuantity = body.tokenGateQuantity ?? null;
    if (body.tokenGateNetwork !== undefined)
      updates.tokenGateNetwork = body.tokenGateNetwork ?? null;
    if (body.tokenGateContractAddress !== undefined)
      updates.tokenGateContractAddress = body.tokenGateContractAddress ?? null;

    if (body.tokenGates !== undefined) {
      // Keep tokenGated true when user checked the box but hasn't added gates yet
      updates.tokenGated =
        body.tokenGates.length > 0 || body.tokenGated === true;
    }

    const [updated] = await db
      .update(productsTable)
      .set(updates as Record<string, unknown>)
      .where(eq(productsTable.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // When token gating is explicitly disabled, clear gate rows so the product is not gated
    // even if tokenGates was not sent (e.g. client only sent tokenGated: false).
    if (body.tokenGated === false) {
      await db
        .delete(productTokenGateTable)
        .where(eq(productTokenGateTable.productId, id));
    }

    if (body.categoryId !== undefined) {
      const categoryId = body.categoryId?.trim() || null;
      await db
        .delete(productCategoriesTable)
        .where(eq(productCategoriesTable.productId, id));
      if (categoryId) {
        await db.insert(productCategoriesTable).values({
          productId: id,
          categoryId,
          isMain: true,
        });
      }
    }

    // Sync perpetual category auto-assign: add to categories product now matches,
    // remove from categories it no longer matches (e.g. after name/brand change).
    await syncProductCategoriesWithAutoRules({
      id: updated.id,
      name: updated.name,
      brand: updated.brand ?? null,
      createdAt: updated.createdAt,
    });

    if (body.images !== undefined) {
      await db
        .delete(productImagesTable)
        .where(eq(productImagesTable.productId, id));
      const now = new Date();
      for (let i = 0; i < body.images.length; i++) {
        const img = body.images[i];
        if (!img?.url?.trim()) continue;
        await db.insert(productImagesTable).values({
          id: img.id ?? crypto.randomUUID(),
          productId: id,
          url: img.url.trim(),
          alt: img.alt?.trim() ?? null,
          title: img.title?.trim() ?? null,
          sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
        });
      }
    }

    if (body.tags !== undefined) {
      await db
        .delete(productTagsTable)
        .where(eq(productTagsTable.productId, id));
      const uniqueTags = [
        ...new Set(body.tags.map((t) => t.trim()).filter(Boolean)),
      ];
      for (const tag of uniqueTags) {
        await db.insert(productTagsTable).values({ productId: id, tag });
      }
    }

    if (body.variants !== undefined) {
      const now = new Date();
      const existingVariants = await db
        .select({
          id: productVariantsTable.id,
          printfulSyncVariantId: productVariantsTable.printfulSyncVariantId,
          printifyVariantId: productVariantsTable.printifyVariantId,
        })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, id));
      const existingById = new Map(
        existingVariants.map((row) => [row.id, row]),
      );
      const bodyVariantIds = new Set(
        body.variants.map((v) => v.id ?? "").filter(Boolean),
      );

      for (const v of body.variants) {
        const variantId = v.id ?? crypto.randomUUID();
        const existing = existingById.get(variantId);
        if (existing) {
          await db
            .update(productVariantsTable)
            .set({
              size: v.size?.trim() ?? null,
              color: v.color?.trim() ?? null,
              sku: v.sku?.trim() ?? null,
              label: v.label?.trim() ?? null,
              stockQuantity: v.stockQuantity ?? null,
              priceCents: v.priceCents,
              imageUrl: v.imageUrl?.trim() ?? null,
              imageAlt: v.imageAlt?.trim() ?? null,
              imageTitle: v.imageTitle?.trim() ?? null,
              updatedAt: now,
            })
            .where(eq(productVariantsTable.id, variantId));
        } else {
          await db.insert(productVariantsTable).values({
            id: variantId,
            productId: id,
            size: v.size?.trim() ?? null,
            color: v.color?.trim() ?? null,
            sku: v.sku?.trim() ?? null,
            label: v.label?.trim() ?? null,
            stockQuantity: v.stockQuantity ?? null,
            priceCents: v.priceCents,
            imageUrl: v.imageUrl?.trim() ?? null,
            imageAlt: v.imageAlt?.trim() ?? null,
            imageTitle: v.imageTitle?.trim() ?? null,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // Remove variants not in body only if they are not vendor-linked (Printful/Printify)
      for (const row of existingVariants) {
        if (
          bodyVariantIds.has(row.id) ||
          row.printfulSyncVariantId != null ||
          row.printifyVariantId != null
        ) {
          continue;
        }
        await db
          .delete(productVariantsTable)
          .where(eq(productVariantsTable.id, row.id));
      }
    }

    if (body.availableCountryCodes !== undefined) {
      await db
        .delete(productAvailableCountryTable)
        .where(eq(productAvailableCountryTable.productId, id));
      const codes = [
        ...new Set(
          body.availableCountryCodes
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        ),
      ];
      for (const code of codes) {
        await db.insert(productAvailableCountryTable).values({
          productId: id,
          countryCode: code,
        });
      }
    }

    if (body.tokenGates !== undefined) {
      await db
        .delete(productTokenGateTable)
        .where(eq(productTokenGateTable.productId, id));
      const gatesToInsert = Array.isArray(body.tokenGates)
        ? body.tokenGates
        : [];
      for (const gate of gatesToInsert) {
        const symbol = String(gate.tokenSymbol ?? "")
          .trim()
          .toUpperCase();
        const qty = Number(gate.quantity);
        if (!symbol || !Number.isInteger(qty) || qty < 1) continue;
        await db.insert(productTokenGateTable).values({
          id: gate.id ?? crypto.randomUUID(),
          productId: id,
          tokenSymbol: symbol,
          quantity: qty,
          network: gate.network?.trim() || null,
          contractAddress: gate.contractAddress?.trim() || null,
        });
      }
    }

    // Push product changes to Printful when product is a Printful sync product
    if (
      updated.source === "printful" &&
      updated.printfulSyncProductId != null
    ) {
      const exportResult = await exportProductToPrintful(id);
      if (!exportResult.success) {
        console.warn(
          `Printful export after admin save failed: ${exportResult.error}`,
        );
      }
    }

    // Push product changes to Printify when product is a Printify product
    if (
      updated.source === "printify" &&
      updated.printifyProductId != null
    ) {
      const exportResult = await exportProductToPrintify(id);
      if (!exportResult.success) {
        console.warn(
          `Printify export after admin save failed: ${exportResult.error}`,
        );
      }
    }

    revalidatePath("/api/products");
    revalidatePath(`/api/products/${id}`); // invalidate single-product API so product page fetch gets fresh data
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/");

    // Return saved token gates so client can update state without relying on refetch
    const savedGatesRows = await db
      .select({
        id: productTokenGateTable.id,
        tokenSymbol: productTokenGateTable.tokenSymbol,
        quantity: productTokenGateTable.quantity,
        network: productTokenGateTable.network,
        contractAddress: productTokenGateTable.contractAddress,
      })
      .from(productTokenGateTable)
      .where(eq(productTokenGateTable.productId, id));
    const tokenGates = savedGatesRows.map((r) => ({
      id: r.id,
      tokenSymbol: r.tokenSymbol,
      quantity: r.quantity,
      network: r.network ?? null,
      contractAddress: r.contractAddress ?? null,
    }));

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      published: updated.published,
      priceCents: updated.priceCents,
      tokenGates,
    });
  } catch (err) {
    console.error("Admin product update error:", err);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 },
    );
  }
}
