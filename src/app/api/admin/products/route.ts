import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "~/db";
import {
  categoriesTable,
  productCategoriesTable,
  productImagesTable,
  productTokenGateTable,
  productsTable,
  productTagsTable,
  productVariantsTable,
} from "~/db/schema";
import { applyCategoryAutoRules } from "~/lib/category-auto-assign";
import { getAdminAuth } from "~/lib/admin-api-auth";

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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const categoryIdParam = request.nextUrl.searchParams.get("categoryId")?.trim() ?? "";
    const vendorParam = request.nextUrl.searchParams.get("vendor")?.trim() ?? "";
    const sortByParam = request.nextUrl.searchParams.get("sortBy")?.trim();
    const sortBy: SortBy =
      sortByParam && SORT_COLUMNS.includes(sortByParam as SortBy)
        ? (sortByParam as SortBy)
        : "createdAt";
    const sortOrderParam = request.nextUrl.searchParams
      .get("sortOrder")
      ?.toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? asc : desc;

    const term = search.length > 0 ? `%${search}%` : "";
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
        inArray(productsTable.id, categoryProductIds.map((r) => r.productId)),
      );
    }
    if (vendorParam) {
      conditions.push(eq(productsTable.vendor, vendorParam));
    }
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

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

    let products: Awaited<ReturnType<typeof db.query.productsTable.findMany>>;
    let countResult: { count: number }[];

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
        orderedIdsQuery = (orderedIdsQuery as unknown as { where: (c: typeof whereClause) => typeof orderedIdsQuery }).where(whereClause);
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
        : db.select({ count: sql<number>`count(*)::int` }).from(productsTable));

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
        );
      }
    } else {
      [products, countResult] = await Promise.all([
        db.query.productsTable.findMany({
          where: whereClause,
          orderBy,
          with: {
            productCategories: {
              with: { category: true },
            },
            productVariants: { columns: { stockQuantity: true } },
          },
          limit,
          offset,
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
    }

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    type ProductWithRelations = (typeof products)[number] & {
      productCategories?: Array<{ isMain?: boolean; categoryId?: string; category?: { name?: string; slug?: string } }>;
      productVariants?: Array<{ stockQuantity?: number | null }>;
    };
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
          (sum: number, v: { stockQuantity?: number | null }) => sum + (v.stockQuantity ?? 0),
          0,
        );
        inventory = `${total} in stock for ${variants.length} variant${variants.length === 1 ? "" : "s"}`;
      } else if (p.trackQuantity && p.quantity != null) {
        inventory = `${p.quantity} in stock`;
      } else {
        inventory = "Not tracked";
      }
      return {
        id: p.id,
        name: p.name,
        slug: p.slug ?? null,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        published: p.published,
        brand: p.brand,
        categoryName: mainPc?.category?.name ?? null,
        categoryId: mainPc?.categoryId ?? null,
        vendor: p.vendor,
        inventory,
      };
    });

    return NextResponse.json({
      items,
      page,
      limit,
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
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      name: string;
      priceCents: number;
      description?: string | null;
      features?: string[];
      imageUrl?: string | null;
      metaDescription?: string | null;
      pageTitle?: string | null;
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
      published?: boolean;
      categoryId?: string | null;
      hasVariants?: boolean;
      optionDefinitionsJson?: string | null;
      tokenGated?: boolean;
      tokenGateType?: string | null;
      tokenGateQuantity?: number | null;
      tokenGateNetwork?: string | null;
      tokenGateContractAddress?: string | null;
      tokenGates?: Array<{
        id?: string;
        tokenSymbol: string;
        quantity: number;
        network?: string | null;
        contractAddress?: string | null;
      }>;
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
        stockQuantity?: number | null;
        priceCents: number;
        imageUrl?: string | null;
      }>;
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
    const slugFromName = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const slug = body.slug?.trim() || slugFromName || null;

    await db.insert(productsTable).values({
      id,
      name,
      priceCents: Math.round(body.priceCents),
      description: body.description?.trim() ?? null,
      featuresJson:
        Array.isArray(body.features) && body.features.length > 0
          ? JSON.stringify(
              body.features.filter(
                (x): x is string => typeof x === "string" && x.trim() !== "",
              ),
            )
          : null,
      imageUrl: body.imageUrl?.trim() ?? null,
      metaDescription: body.metaDescription?.trim() ?? null,
      pageTitle: body.pageTitle?.trim() ?? null,
      compareAtPriceCents: body.compareAtPriceCents ?? null,
      costPerItemCents: body.costPerItemCents ?? null,
      brand: body.brand?.trim() ?? null,
      vendor: body.vendor?.trim() ?? null,
      slug,
      sku: body.sku?.trim() ?? null,
      barcode: body.barcode?.trim() ?? null,
      weightGrams: body.weightGrams ?? null,
      weightUnit: body.weightUnit ?? null,
      physicalProduct: body.physicalProduct ?? true,
      trackQuantity: body.trackQuantity ?? false,
      continueSellingWhenOutOfStock:
        body.continueSellingWhenOutOfStock ?? false,
      quantity: body.quantity ?? null,
      hsCode: body.hsCode?.trim() ?? null,
      countryOfOrigin: body.countryOfOrigin?.trim() ?? null,
      shipsFromDisplay: body.shipsFromDisplay?.trim() ?? null,
      shipsFromCountry: body.shipsFromCountry?.trim() ?? null,
      shipsFromRegion: body.shipsFromRegion?.trim() ?? null,
      shipsFromCity: body.shipsFromCity?.trim() ?? null,
      shipsFromPostalCode: body.shipsFromPostalCode?.trim() ?? null,
      published: body.published ?? true,
      hasVariants: body.hasVariants ?? false,
      optionDefinitionsJson: body.optionDefinitionsJson ?? null,
      tokenGated:
        (Array.isArray(body.tokenGates) && body.tokenGates.length > 0) ||
        (body.tokenGated ?? false),
      tokenGateType: body.tokenGateType ?? null,
      tokenGateQuantity: body.tokenGateQuantity ?? null,
      tokenGateNetwork: body.tokenGateNetwork ?? null,
      tokenGateContractAddress: body.tokenGateContractAddress ?? null,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });

    if (Array.isArray(body.tokenGates) && body.tokenGates.length > 0) {
      for (const gate of body.tokenGates) {
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

    const categoryId = body.categoryId?.trim() || null;
    if (categoryId) {
      await db.insert(productCategoriesTable).values({
        productId: id,
        categoryId,
        isMain: true,
      });
    }

    if (body.images?.length) {
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

    if (body.tags?.length) {
      const uniqueTags = [
        ...new Set(body.tags.map((t) => t.trim()).filter(Boolean)),
      ];
      for (const tag of uniqueTags) {
        await db.insert(productTagsTable).values({ productId: id, tag });
      }
    }

    if (body.variants?.length && body.hasVariants) {
      for (const v of body.variants) {
        await db.insert(productVariantsTable).values({
          id: v.id ?? crypto.randomUUID(),
          productId: id,
          size: v.size?.trim() ?? null,
          color: v.color?.trim() ?? null,
          sku: v.sku?.trim() ?? null,
          stockQuantity: v.stockQuantity ?? null,
          priceCents: v.priceCents,
          imageUrl: v.imageUrl?.trim() ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await applyCategoryAutoRules({
      id,
      name,
      brand: body.brand?.trim() ?? null,
      createdAt: now,
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
