import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  productAvailableCountryTable,
  productCategoriesTable,
  productImagesTable,
  productsTable,
  productTagsTable,
  productTokenGateTable,
  productVariantsTable,
} from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { syncProductCategoriesWithAutoRules } from "~/lib/category-auto-assign";
import { exportProductToPrintful } from "~/lib/printful-sync";
import { exportProductToPrintify } from "~/lib/printify-sync";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { slugify } from "~/lib/slugify";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const product = await getProductByParam(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await db.delete(productsTable).where(eq(productsTable.id, product.id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin product delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: param } = await params;
    const product = await getProductByParam(param);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const productId = product.id;

    const [
      productCategoriesRows,
      images,
      tags,
      variants,
      availableCountries,
      tokenGatesRows,
    ] = await Promise.all([
      db
        .select({
          categoryId: productCategoriesTable.categoryId,
          isMain: productCategoriesTable.isMain,
        })
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.productId, productId)),
      db
        .select()
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, productId))
        .orderBy(asc(productImagesTable.sortOrder), asc(productImagesTable.id)),
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
          contractAddress: productTokenGateTable.contractAddress,
          id: productTokenGateTable.id,
          network: productTokenGateTable.network,
          quantity: productTokenGateTable.quantity,
          tokenSymbol: productTokenGateTable.tokenSymbol,
        })
        .from(productTokenGateTable)
        .where(eq(productTokenGateTable.productId, productId)),
    ]);

    const slug = product.slug?.trim() || slugify(product.name) || null;

    const tokenGates = tokenGatesRows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
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
      availableCountryCodes: availableCountries
        .map((r) => r.countryCode)
        .filter((c) => !isShippingExcluded(c)),
      barcode: product.barcode,
      brand: product.brand,
      categoryId:
        productCategoriesRows.find((r) => r.isMain)?.categoryId ??
        productCategoriesRows[0]?.categoryId ??
        null,
      categoryIds: productCategoriesRows.map((r) => r.categoryId),
      compareAtPriceCents: product.compareAtPriceCents,
      continueSellingWhenOutOfStock: product.continueSellingWhenOutOfStock,
      costPerItemCents: product.costPerItemCents,
      countryOfOrigin: product.countryOfOrigin,
      description: product.description,
      features,
      hasVariants: product.hasVariants,
      hidden: product.hidden,
      hsCode: product.hsCode,
      id: product.id,
      images: images.map((img) => ({
        alt: img.alt,
        id: img.id,
        sortOrder: img.sortOrder,
        title: img.title,
        url: img.url,
      })),
      imageUrl: product.imageUrl,
      mainCategoryId:
        productCategoriesRows.find((r) => r.isMain)?.categoryId ?? null,
      mainImageAlt: product.mainImageAlt ?? null,
      mainImageTitle: product.mainImageTitle ?? null,
      metaDescription: product.metaDescription,
      name: product.name,
      optionDefinitionsJson: product.optionDefinitionsJson,
      pageTitle: product.pageTitle,
      physicalProduct: product.physicalProduct,
      priceCents: product.priceCents,
      printifyProductId: product.printifyProductId ?? null,
      published: product.published,
      quantity: product.quantity,
      seoOptimized: product.seoOptimized,
      shipsFromCity: product.shipsFromCity ?? null,
      shipsFromCountry: product.shipsFromCountry ?? null,
      shipsFromDisplay: product.shipsFromDisplay ?? null,
      shipsFromPostalCode: product.shipsFromPostalCode ?? null,
      shipsFromRegion: product.shipsFromRegion ?? null,
      sku: product.sku,
      slug,
      source: product.source ?? "manual",
      tags: tags.map((t) => t.tag),
      tokenGateContractAddress: product.tokenGateContractAddress,
      tokenGated: tokenGates.length > 0 || product.tokenGated,
      tokenGateNetwork: product.tokenGateNetwork,
      tokenGateQuantity: product.tokenGateQuantity,
      tokenGates,
      tokenGateType: product.tokenGateType,
      trackQuantity: product.trackQuantity,
      variants: variants.map((v) => ({
        availabilityStatus: v.availabilityStatus ?? null,
        color: v.color,
        externalId: v.externalId ?? null,
        id: v.id,
        imageAlt: v.imageAlt ?? null,
        imageTitle: v.imageTitle ?? null,
        imageUrl: v.imageUrl,
        label: v.label ?? null,
        priceCents: v.priceCents,
        printfulSyncVariantId: v.printfulSyncVariantId ?? null,
        printifyVariantId: v.printifyVariantId ?? null,
        size: v.size,
        sku: v.sku,
        stockQuantity: v.stockQuantity,
      })),
      vendor: product.vendor,
      weightGrams: product.weightGrams,
      weightUnit: product.weightUnit,
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
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id: param } = await params;
    // TODO: Standardize error response format across admin routes (L20)
    // nanoid uses A-Za-z0-9_- ; slugs use a-z0-9-
    const NANOID_RE = /^[A-Za-z0-9_-]{10,40}$/;
    if (!NANOID_RE.test(param) && !/^[a-z0-9-]+$/.test(param)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
    const existing = await getProductByParam(param);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    const id = existing.id;
    const body = (await request.json()) as {
      availableCountryCodes?: string[];
      barcode?: null | string;
      brand?: null | string;
      categoryId?: null | string;
      categoryIds?: string[];
      compareAtPriceCents?: null | number;
      continueSellingWhenOutOfStock?: boolean;
      costPerItemCents?: null | number;
      countryOfOrigin?: null | string;
      description?: null | string;
      features?: string[];
      hasVariants?: boolean;
      hidden?: boolean;
      hsCode?: null | string;
      images?: {
        alt?: null | string;
        id?: string;
        sortOrder?: number;
        title?: null | string;
        url: string;
      }[];
      imageUrl?: null | string;
      mainCategoryId?: null | string;
      mainImageAlt?: null | string;
      mainImageTitle?: null | string;
      metaDescription?: null | string;
      name?: string;
      optionDefinitionsJson?: null | string;
      pageTitle?: null | string;
      physicalProduct?: boolean;
      priceCents?: number;
      published?: boolean;
      quantity?: null | number;
      seoOptimized?: boolean;
      shipsFromCity?: null | string;
      shipsFromCountry?: null | string;
      shipsFromDisplay?: null | string;
      shipsFromPostalCode?: null | string;
      shipsFromRegion?: null | string;
      sku?: null | string;
      slug?: null | string;
      tags?: string[];
      tokenGateContractAddress?: null | string;
      tokenGated?: boolean;
      tokenGateNetwork?: null | string;
      tokenGateQuantity?: null | number;
      tokenGates?: {
        contractAddress?: null | string;
        id?: string;
        network?: null | string;
        quantity: number;
        tokenSymbol: string;
      }[];
      tokenGateType?: null | string;
      trackQuantity?: boolean;
      variants?: {
        color?: null | string;
        id?: string;
        imageAlt?: null | string;
        imageTitle?: null | string;
        imageUrl?: null | string;
        label?: null | string;
        priceCents: number;
        size?: null | string;
        sku?: null | string;
        stockQuantity?: null | number;
      }[];
      vendor?: null | string;
      weightGrams?: null | number;
      weightUnit?: null | string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.published === "boolean") updates.published = body.published;
    if (typeof body.hidden === "boolean") updates.hidden = body.hidden;
    if (typeof body.name === "string") updates.name = body.name;
    if (body.description !== undefined)
      updates.description = body.description ?? null;
    if (body.features !== undefined) {
      const arr = Array.isArray(body.features)
        ? body.features.filter(
            (x): x is string => typeof x === "string" && x.trim() !== "",
          )
        : [];
      updates.featuresJson = arr.length > 0 ? JSON.stringify(arr) : null;
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
    if (typeof body.seoOptimized === "boolean")
      updates.seoOptimized = body.seoOptimized;
    if (typeof body.priceCents === "number") {
      if (body.priceCents < 0) {
        return NextResponse.json(
          { error: "Price cannot be negative" },
          { status: 400 },
        );
      }
      updates.priceCents = body.priceCents;
    }
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

    let savedCategoryIds: string[] | undefined;
    if (body.categoryIds !== undefined || body.categoryId !== undefined) {
      const categoryIds = Array.isArray(body.categoryIds)
        ? body.categoryIds.filter(
            (c): c is string => typeof c === "string" && c.trim() !== "",
          )
        : body.categoryId !== undefined && body.categoryId?.trim()
          ? [body.categoryId.trim()]
          : [];
      const mainCategoryId =
        typeof body.mainCategoryId === "string" && body.mainCategoryId.trim()
          ? body.mainCategoryId.trim()
          : (categoryIds[0] ?? null);
      if (categoryIds.length > 0) {
        const existingCategories = await db
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(inArray(categoriesTable.id, categoryIds));
        const existingIds = new Set(existingCategories.map((r) => r.id));
        const invalidIds = categoryIds.filter((cid) => !existingIds.has(cid));
        if (invalidIds.length > 0) {
          return NextResponse.json(
            {
              error:
                "Invalid category ID(s). Categories may have been deleted or the list is stale. Refresh the page and try again.",
              invalidCategoryIds: invalidIds,
            },
            { status: 400 },
          );
        }
      }
      await db
        .delete(productCategoriesTable)
        .where(eq(productCategoriesTable.productId, id));
      if (categoryIds.length > 0) {
        await db.insert(productCategoriesTable).values(
          categoryIds.map((categoryId) => ({
            categoryId,
            isMain: categoryId === mainCategoryId,
            productId: id,
          })),
        );
      }
      savedCategoryIds = categoryIds;
    }

    // Sync perpetual category auto-assign: add to categories product now matches,
    // remove from categories it no longer matches (e.g. after name/brand change).
    // Preserve categories the user just explicitly set so they are not removed by rules.
    await syncProductCategoriesWithAutoRules(
      {
        brand: updated.brand ?? null,
        createdAt: updated.createdAt,
        id: updated.id,
        name: updated.name,
      },
      savedCategoryIds,
    );

    if (body.images !== undefined) {
      await db
        .delete(productImagesTable)
        .where(eq(productImagesTable.productId, id));
      const now = new Date();
      const imageValues = body.images
        .map((img, i) => {
          if (!img?.url?.trim()) return null;
          return {
            alt: img.alt?.trim() ?? null,
            id: img.id ?? crypto.randomUUID(),
            productId: id,
            sortOrder: typeof img.sortOrder === "number" ? img.sortOrder : i,
            title: img.title?.trim() ?? null,
            url: img.url.trim(),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (imageValues.length > 0) {
        await db.insert(productImagesTable).values(imageValues);
      }
    }

    if (body.tags !== undefined) {
      await db
        .delete(productTagsTable)
        .where(eq(productTagsTable.productId, id));
      const uniqueTags = [
        ...new Set(body.tags.map((t) => t.trim()).filter(Boolean)),
      ];
      if (uniqueTags.length > 0) {
        await db
          .insert(productTagsTable)
          .values(uniqueTags.map((tag) => ({ productId: id, tag })));
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
              color: v.color?.trim() ?? null,
              imageAlt: v.imageAlt?.trim() ?? null,
              imageTitle: v.imageTitle?.trim() ?? null,
              imageUrl: v.imageUrl?.trim() ?? null,
              label: v.label?.trim() ?? null,
              priceCents: v.priceCents,
              size: v.size?.trim() ?? null,
              sku: v.sku?.trim() ?? null,
              stockQuantity: v.stockQuantity ?? null,
              updatedAt: now,
            })
            .where(eq(productVariantsTable.id, variantId));
        } else {
          await db.insert(productVariantsTable).values({
            color: v.color?.trim() ?? null,
            createdAt: now,
            id: variantId,
            imageAlt: v.imageAlt?.trim() ?? null,
            imageTitle: v.imageTitle?.trim() ?? null,
            imageUrl: v.imageUrl?.trim() ?? null,
            label: v.label?.trim() ?? null,
            priceCents: v.priceCents,
            productId: id,
            size: v.size?.trim() ?? null,
            sku: v.sku?.trim() ?? null,
            stockQuantity: v.stockQuantity ?? null,
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
            .filter(Boolean)
            .filter((c) => !isShippingExcluded(c)),
        ),
      ];
      for (const code of codes) {
        await db.insert(productAvailableCountryTable).values({
          countryCode: code,
          productId: id,
        });
      }
    }

    if (body.tokenGates !== undefined) {
      await db
        .delete(productTokenGateTable)
        .where(eq(productTokenGateTable.productId, id));
      const gatesToInsert = (
        Array.isArray(body.tokenGates) ? body.tokenGates : []
      )
        .map((gate) => {
          const symbol = String(gate.tokenSymbol ?? "")
            .trim()
            .toUpperCase();
          const qty = Number(gate.quantity);
          if (!symbol || !Number.isInteger(qty) || qty < 1) return null;
          return {
            contractAddress: gate.contractAddress?.trim() || null,
            id: gate.id ?? crypto.randomUUID(),
            network: gate.network?.trim() || null,
            productId: id,
            quantity: qty,
            tokenSymbol: symbol,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (gatesToInsert.length > 0) {
        await db.insert(productTokenGateTable).values(gatesToInsert);
      }
    }

    // Push product changes to Printful when product is a Printful sync product
    let printfulExportError: null | string = null;
    if (
      updated.source === "printful" &&
      updated.printfulSyncProductId != null
    ) {
      const exportResult = await exportProductToPrintful(id);
      if (!exportResult.success) {
        printfulExportError = exportResult.error ?? "Printful export failed";
        console.warn(
          `Printful export after admin save failed: ${printfulExportError}`,
        );
      }
    }

    // Push product changes to Printify when product is a Printify product
    let printifyExportError: null | string = null;
    if (updated.source === "printify" && updated.printifyProductId != null) {
      const exportResult = await exportProductToPrintify(id);
      if (!exportResult.success) {
        printifyExportError = exportResult.error ?? "Printify export failed";
        const isPublishingBlock =
          printifyExportError.includes("Publishing") ||
          printifyExportError.includes("8252");
        if (isPublishingBlock) {
          console.info(
            "Printify export skipped: product is in Publishing (edits blocked until Published).",
          );
        } else {
          console.warn(
            `Printify export after admin save failed: ${printifyExportError}`,
          );
        }
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
        contractAddress: productTokenGateTable.contractAddress,
        id: productTokenGateTable.id,
        network: productTokenGateTable.network,
        quantity: productTokenGateTable.quantity,
        tokenSymbol: productTokenGateTable.tokenSymbol,
      })
      .from(productTokenGateTable)
      .where(eq(productTokenGateTable.productId, id));
    const tokenGates = savedGatesRows.map((r) => ({
      contractAddress: r.contractAddress ?? null,
      id: r.id,
      network: r.network ?? null,
      quantity: r.quantity,
      tokenSymbol: r.tokenSymbol,
    }));

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      priceCents: updated.priceCents,
      published: updated.published,
      tokenGates,
      ...(printfulExportError != null && {
        printfulExportError,
      }),
      ...(printifyExportError != null && {
        printifyExportError,
      }),
    });
  } catch (err) {
    console.error("Admin product update error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to update product";
    return NextResponse.json(
      {
        error: "Failed to update product",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 },
    );
  }
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
