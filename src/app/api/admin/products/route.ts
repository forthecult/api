import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
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
import { applyCategoryAutoRules } from "~/lib/category-auto-assign";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { slugify } from "~/lib/slugify";

/** Escape SQL LIKE/ILIKE special characters */
function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, (c) => `\\${c}`);
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SORT_COLUMNS = [
  "name",
  "brand",
  "vendor",
  "price",
  "published",
  "createdAt",
  "category",
  "inStock",
] as const;
type SortBy = (typeof SORT_COLUMNS)[number];

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const tagParam = request.nextUrl.searchParams.get("tag")?.trim() ?? "";
    const minimal = request.nextUrl.searchParams.get("minimal") === "1";
    if ((tagParam === "SOLUNA" || tagParam === "Crustafarian") && minimal) {
      const tagProductIds = await db
        .select({ productId: productTagsTable.productId })
        .from(productTagsTable)
        .where(eq(productTagsTable.tag, tagParam));
      const ids = [...new Set(tagProductIds.map((r) => r.productId))];
      if (ids.length === 0) {
        return NextResponse.json({ products: [] });
      }
      const rows = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          printifyProductId: productsTable.printifyProductId,
        })
        .from(productsTable)
        .where(
          and(
            inArray(productsTable.id, ids),
            eq(productsTable.source, "printify"),
            isNotNull(productsTable.printifyProductId),
          ),
        );
      const products = rows
        .filter((r) => r.printifyProductId != null)
        .map((r) => ({
          id: r.id,
          name: r.name,
          printifyProductId: r.printifyProductId!,
        }));
      return NextResponse.json({ products });
    }

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ??
            String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;
    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const categoryIdParam =
      request.nextUrl.searchParams.get("categoryId")?.trim() ?? "";
    const vendorParam =
      request.nextUrl.searchParams.get("vendor")?.trim() ?? "";
    const sortByParam = request.nextUrl.searchParams.get("sortBy")?.trim();
    const sortBy: SortBy =
      sortByParam && SORT_COLUMNS.includes(sortByParam as SortBy)
        ? (sortByParam as SortBy)
        : "createdAt";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? asc : desc;

    const term = search.length > 0 ? `%${escapeLike(search)}%` : "";
    const conditions: ReturnType<typeof or>[] = [];
    if (search.length > 0) {
      conditions.push(
        or(
          ilike(productsTable.name, term),
          ilike(productsTable.id, term),
          ilike(productsTable.brand, term),
        ) as ReturnType<typeof or>,
      );
    }
    if (categoryIdParam) {
      const categoryProductIds = await db
        .select({ productId: productCategoriesTable.productId })
        .from(productCategoriesTable)
        .where(eq(productCategoriesTable.categoryId, categoryIdParam));
      conditions.push(
        inArray(
          productsTable.id,
          categoryProductIds.map((r) => r.productId),
        ),
      );
    }
    if (vendorParam) {
      conditions.push(eq(productsTable.vendor, vendorParam));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      sortBy === "price"
        ? [sortOrder(productsTable.priceCents)]
        : sortBy === "name"
          ? [sortOrder(productsTable.name)]
          : sortBy === "brand"
            ? [sortOrder(productsTable.brand)]
            : sortBy === "vendor"
              ? [sortOrder(productsTable.vendor)]
              : sortBy === "published"
                ? [sortOrder(productsTable.published)]
                : sortBy === "inStock"
                  ? [sortOrder(productsTable.quantity)]
                  : [sortOrder(productsTable.createdAt)];

    interface ProductWithRelations {
      brand: null | string;
      hasVariants: boolean;
      id: string;
      imageUrl: null | string;
      name: string;
      priceCents: number;
      printifyProductId: null | string;
      productCategories?: {
        category?: { name?: string; slug?: string };
        categoryId?: string;
        isMain?: boolean;
      }[];
      productVariants?: { stockQuantity?: null | number }[];
      published: boolean;
      quantity: null | number;
      slug: null | string;
      trackQuantity: boolean;
      vendor: null | string;
    }
    let products: ProductWithRelations[] = [];
    let countResult: { count: number }[] = [{ count: 0 }];

    const runFullQuery = async (): Promise<void> => {
      if (sortBy === "category") {
        let orderedIdsQuery = db
          .select({ id: productsTable.id })
          .from(productsTable)
          .leftJoin(
            productCategoriesTable,
            and(
              eq(productCategoriesTable.productId, productsTable.id),
              eq(productCategoriesTable.isMain, true),
            ),
          )
          .leftJoin(
            categoriesTable,
            eq(categoriesTable.id, productCategoriesTable.categoryId),
          );
        if (whereClause !== undefined) {
          orderedIdsQuery = (
            orderedIdsQuery as unknown as {
              where: (c: typeof whereClause) => typeof orderedIdsQuery;
            }
          ).where(whereClause);
        }
        const orderedIds = await orderedIdsQuery
          .orderBy(sortOrder(categoriesTable.name), asc(productsTable.id))
          .limit(limit)
          .offset(offset)
          .then((rows) => rows.map((r) => r.id));

        countResult = await (whereClause !== undefined
          ? db
              .select({ count: sql<number>`count(*)::int` })
              .from(productsTable)
              .where(whereClause)
          : db
              .select({ count: sql<number>`count(*)::int` })
              .from(productsTable));

        if (orderedIds.length === 0) {
          products = [];
        } else {
          const byId = await db.query.productsTable.findMany({
            where: inArray(productsTable.id, orderedIds),
            with: {
              productCategories: {
                with: { category: true },
              },
              productVariants: { columns: { stockQuantity: true } },
            },
          });
          const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
          products = byId.sort(
            (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
          ) as ProductWithRelations[];
        }
      } else {
        const [prods, count] = await Promise.all([
          db.query.productsTable.findMany({
            limit,
            offset,
            orderBy,
            where: whereClause,
            with: {
              productCategories: {
                with: { category: true },
              },
              productVariants: { columns: { stockQuantity: true } },
            },
          }),
          whereClause !== undefined
            ? db
                .select({ count: sql<number>`count(*)::int` })
                .from(productsTable)
                .where(whereClause)
            : db
                .select({ count: sql<number>`count(*)::int` })
                .from(productsTable),
        ]);
        products = prods as ProductWithRelations[];
        countResult = count;
      }
    };

    const runFallbackQuery = async (): Promise<void> => {
      // Products-only query when product_category or product_variant have schema issues
      const fallbackWhere = vendorParam
        ? eq(productsTable.vendor, vendorParam)
        : search.length > 0
          ? or(
              ilike(productsTable.name, term),
              ilike(productsTable.id, term),
              ilike(productsTable.brand, term),
            )
          : undefined;
      const fallbackOrder =
        sortBy === "name"
          ? [sortOrder(productsTable.name)]
          : sortBy === "createdAt"
            ? [sortOrder(productsTable.createdAt)]
            : [desc(productsTable.createdAt)];
      const selectQuery = db
        .select({
          brand: productsTable.brand,
          hasVariants: productsTable.hasVariants,
          id: productsTable.id,
          imageUrl: productsTable.imageUrl,
          name: productsTable.name,
          priceCents: productsTable.priceCents,
          printifyProductId: productsTable.printifyProductId,
          published: productsTable.published,
          quantity: productsTable.quantity,
          slug: productsTable.slug,
          trackQuantity: productsTable.trackQuantity,
          vendor: productsTable.vendor,
        })
        .from(productsTable)
        .orderBy(...fallbackOrder)
        .limit(limit)
        .offset(offset);
      const selectWithWhere = fallbackWhere
        ? selectQuery.where(fallbackWhere)
        : selectQuery;
      const countQuery = fallbackWhere
        ? db
            .select({ count: sql<number>`count(*)::int` })
            .from(productsTable)
            .where(fallbackWhere)
        : db.select({ count: sql<number>`count(*)::int` }).from(productsTable);
      const [prods, count] = await Promise.all([selectWithWhere, countQuery]);
      products = prods.map((p) => ({
        ...p,
        productCategories: undefined,
        productVariants: undefined,
      }));
      countResult = count;
    };

    try {
      await runFullQuery();
    } catch (queryErr) {
      const msg =
        queryErr instanceof Error ? queryErr.message : String(queryErr);
      const mayBeSchemaError =
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("Failed query");
      if (mayBeSchemaError) {
        console.warn("Admin products: full query failed, using fallback:", msg);
        await runFallbackQuery();
      } else {
        throw queryErr;
      }
    }

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const items = products.map((p: ProductWithRelations) => {
      const mainPc =
        p.productCategories?.find((pc: { isMain?: boolean }) => pc.isMain) ??
        p.productCategories?.[0];
      const variants = p.productVariants ?? [];
      let inventory: string;
      if (!p.trackQuantity && variants.length === 0) {
        inventory = "Not tracked";
      } else if (p.hasVariants && variants.length > 0) {
        const total = variants.reduce(
          (sum: number, v: { stockQuantity?: null | number }) =>
            sum + (v.stockQuantity ?? 0),
          0,
        );
        inventory = `${total} in stock for ${variants.length} variant${variants.length === 1 ? "" : "s"}`;
      } else if (p.trackQuantity && p.quantity != null) {
        inventory = `${p.quantity} in stock`;
      } else {
        inventory = "Not tracked";
      }
      return {
        brand: p.brand,
        categoryId: mainPc?.categoryId ?? null,
        categoryName: mainPc?.category?.name ?? null,
        id: p.id,
        imageUrl: p.imageUrl,
        inventory,
        name: p.name,
        priceCents: p.priceCents,
        printifyProductId: p.printifyProductId ?? null,
        published: p.published,
        slug: p.slug ?? null,
        vendor: p.vendor,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin products list error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to load products";
    const devError =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? { detail: err.message, stack: err.stack }
        : undefined;
    return NextResponse.json({ error: message, ...devError }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      availableCountryCodes?: string[];
      barcode?: null | string;
      brand?: null | string;
      categoryId?: null | string;
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
      mainImageAlt?: null | string;
      mainImageTitle?: null | string;
      metaDescription?: null | string;
      name: string;
      optionDefinitionsJson?: null | string;
      pageTitle?: null | string;
      physicalProduct?: boolean;
      priceCents: number;
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

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 },
      );
    }
    if (typeof body.priceCents !== "number" || body.priceCents < 0) {
      return NextResponse.json(
        { error: "priceCents is required and must be a non-negative number" },
        { status: 400 },
      );
    }

    const now = new Date();
    const id = crypto.randomUUID();
    const name = body.name.trim();
    const slug = body.slug?.trim() || slugify(name) || null;

    await db.insert(productsTable).values({
      barcode: body.barcode?.trim() ?? null,
      brand: body.brand?.trim() ?? null,
      compareAtPriceCents: body.compareAtPriceCents ?? null,
      continueSellingWhenOutOfStock:
        body.continueSellingWhenOutOfStock ?? false,
      costPerItemCents: body.costPerItemCents ?? null,
      countryOfOrigin: body.countryOfOrigin?.trim() ?? null,
      createdAt: now,
      description: body.description?.trim() ?? null,
      featuresJson:
        Array.isArray(body.features) && body.features.length > 0
          ? JSON.stringify(
              body.features.filter(
                (x): x is string => typeof x === "string" && x.trim() !== "",
              ),
            )
          : null,
      hasVariants: body.hasVariants ?? false,
      hidden: body.hidden ?? false,
      hsCode: body.hsCode?.trim() ?? null,
      id,
      imageUrl: body.imageUrl?.trim() ?? null,
      mainImageAlt: body.mainImageAlt?.trim() ?? null,
      mainImageTitle: body.mainImageTitle?.trim() ?? null,
      metaDescription: body.metaDescription?.trim() ?? null,
      name,
      optionDefinitionsJson: body.optionDefinitionsJson ?? null,
      pageTitle: body.pageTitle?.trim() ?? null,
      physicalProduct: body.physicalProduct ?? true,
      priceCents: Math.round(body.priceCents),
      published: body.published ?? true,
      quantity: body.quantity ?? null,
      seoOptimized: body.seoOptimized ?? false,
      shipsFromCity: body.shipsFromCity?.trim() ?? null,
      shipsFromCountry: body.shipsFromCountry?.trim() ?? null,
      shipsFromDisplay: body.shipsFromDisplay?.trim() ?? null,
      shipsFromPostalCode: body.shipsFromPostalCode?.trim() ?? null,
      shipsFromRegion: body.shipsFromRegion?.trim() ?? null,
      sku: body.sku?.trim() ?? null,
      slug,
      source: "manual",
      tokenGateContractAddress: body.tokenGateContractAddress ?? null,
      tokenGated:
        (Array.isArray(body.tokenGates) && body.tokenGates.length > 0) ||
        (body.tokenGated ?? false),
      tokenGateNetwork: body.tokenGateNetwork ?? null,
      tokenGateQuantity: body.tokenGateQuantity ?? null,
      tokenGateType: body.tokenGateType ?? null,
      trackQuantity: body.trackQuantity ?? false,
      updatedAt: now,
      vendor: body.vendor?.trim() ?? null,
      weightGrams: body.weightGrams ?? null,
      weightUnit: body.weightUnit ?? null,
    });

    if (Array.isArray(body.tokenGates) && body.tokenGates.length > 0) {
      const gateValues = body.tokenGates
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
      if (gateValues.length > 0) {
        await db.insert(productTokenGateTable).values(gateValues);
      }
    }

    const categoryId = body.categoryId?.trim() || null;
    if (categoryId) {
      await db.insert(productCategoriesTable).values({
        categoryId,
        isMain: true,
        productId: id,
      });
    }

    if (
      Array.isArray(body.availableCountryCodes) &&
      body.availableCountryCodes.length > 0
    ) {
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

    if (body.images?.length) {
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

    if (body.tags?.length) {
      const uniqueTags = [
        ...new Set(body.tags.map((t) => t.trim()).filter(Boolean)),
      ];
      for (const tag of uniqueTags) {
        await db.insert(productTagsTable).values({ productId: id, tag });
      }
    }

    if (body.variants?.length && body.hasVariants) {
      await db.insert(productVariantsTable).values(
        body.variants.map((v) => ({
          color: v.color?.trim() ?? null,
          createdAt: now,
          id: v.id ?? crypto.randomUUID(),
          imageUrl: v.imageUrl?.trim() ?? null,
          label: v.label?.trim() ?? null,
          priceCents: v.priceCents,
          productId: id,
          size: v.size?.trim() ?? null,
          sku: v.sku?.trim() ?? null,
          stockQuantity: v.stockQuantity ?? null,
          updatedAt: now,
        })),
      );
    }

    await applyCategoryAutoRules({
      brand: body.brand?.trim() ?? null,
      createdAt: now,
      id,
      name,
    });

    revalidatePath("/api/products");
    revalidatePath(`/api/products/${id}`);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    revalidatePath("/");
    return NextResponse.json({ id, name }, { status: 201 });
  } catch (err) {
    console.error("Admin product create error:", err);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 },
    );
  }
}
