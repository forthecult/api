/**
 * Category helpers for storefront: lookup by slug, list slugs, breadcrumbs.
 */

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";

import { db } from "~/db";
import {
  categoriesTable,
  orderItemsTable,
  productCategoriesTable,
  productsTable,
} from "~/db/schema";
import { sortSubcategories } from "~/lib/category-sort";

export interface BreadcrumbItem {
  href: string;
  name: string;
}

export interface CategoryBySlug {
  description: null | string;
  id: string;
  imageUrl: null | string;
  metaDescription: null | string;
  name: string;
  parentId: null | string;
  slug: string;
  title: null | string;
  tokenGated: boolean;
}

export interface CategoryWithDisplayImage {
  /** Category image if set; otherwise product fallback (top-selling or most recent). Not persisted. */
  image?: null | string;
  name: string;
  slug: string;
}

export interface SubcategoryOption {
  name: string;
  slug: string;
}

/**
 * All category slugs and names (for filter dropdown and URL validation).
 * Includes categories with no products so every category has a page.
 */
export async function getAllCategorySlugsAndNames(): Promise<
  { name: string; slug: string }[]
> {
  const rows = await db
    .select({
      name: categoriesTable.name,
      slug: categoriesTable.slug,
    })
    .from(categoriesTable)
    .where(isNotNull(categoriesTable.slug))
    .orderBy(asc(categoriesTable.name));
  return rows
    .filter((r): r is { name: string; slug: string } => r.slug != null)
    .map((r) => ({ name: r.name, slug: r.slug! }));
}

/**
 * Categories that have at least one published product, with a display image.
 * Image is category.imageUrl if set; otherwise from top-selling product in that category,
 * or most recently created product. Fallback is for display only (not saved to category).
 *
 * @param opts.topLevelOnly - When true, only return top-level categories (parentId IS NULL).
 *   Useful for the main /products page to avoid overwhelming users with subcategories.
 */
export async function getCategoriesWithProductsAndDisplayImage(opts?: {
  topLevelOnly?: boolean;
}): Promise<CategoryWithDisplayImage[]> {
  const catIdsWithProducts = await db
    .selectDistinct({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable)
    .innerJoin(
      productsTable,
      and(
        eq(productCategoriesTable.productId, productsTable.id),
        eq(productsTable.published, true),
        eq(productsTable.hidden, false),
      ),
    );

  const ids = catIdsWithProducts
    .map((r) => r.categoryId)
    .filter((id): id is string => !!id);
  if (ids.length === 0) return [];

  // Try to include the `visible` filter; fall back if the column doesn't exist yet.
  let categories: {
    id: string;
    imageUrl: null | string;
    name: string;
    slug: null | string;
  }[];
  try {
    const whereConditions = opts?.topLevelOnly
      ? and(
          inArray(categoriesTable.id, ids),
          isNull(categoriesTable.parentId),
          eq(categoriesTable.visible, true),
        )
      : and(
          inArray(categoriesTable.id, ids),
          eq(categoriesTable.visible, true),
        );
    categories = await db
      .select({
        id: categoriesTable.id,
        imageUrl: categoriesTable.imageUrl,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .where(whereConditions)
      .orderBy(asc(categoriesTable.name));
  } catch {
    const whereConditions = opts?.topLevelOnly
      ? and(inArray(categoriesTable.id, ids), isNull(categoriesTable.parentId))
      : inArray(categoriesTable.id, ids);
    categories = await db
      .select({
        id: categoriesTable.id,
        imageUrl: categoriesTable.imageUrl,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .where(whereConditions)
      .orderBy(asc(categoriesTable.name));
  }

  const needFallback = categories.filter(
    (c) => c.imageUrl == null || c.imageUrl.trim() === "",
  );
  const fallbackByCategoryId = new Map<string, string>();

  if (needFallback.length > 0) {
    const needIds = needFallback.map((c) => c.id);

    const soldSubq = db
      .select({
        categoryId: productCategoriesTable.categoryId,
        productId: productCategoriesTable.productId,
        qty: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)::int`.as(
          "qty",
        ),
      })
      .from(productCategoriesTable)
      .innerJoin(
        orderItemsTable,
        eq(productCategoriesTable.productId, orderItemsTable.productId),
      )
      .where(inArray(productCategoriesTable.categoryId, needIds))
      .groupBy(
        productCategoriesTable.categoryId,
        productCategoriesTable.productId,
      )
      .as("sold");

    const topPerCategory = await db
      .select({
        categoryId: soldSubq.categoryId,
        productId: soldSubq.productId,
        qty: soldSubq.qty,
      })
      .from(soldSubq)
      .orderBy(desc(soldSubq.qty));

    const seen = new Set<string>();
    const topProductIds: string[] = [];
    const categoryForProduct = new Map<string, string>();
    for (const row of topPerCategory) {
      if (row.categoryId && !seen.has(row.categoryId) && row.productId) {
        seen.add(row.categoryId);
        topProductIds.push(row.productId);
        categoryForProduct.set(row.productId, row.categoryId);
      }
    }
    if (topProductIds.length > 0) {
      const products = await db
        .select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
        .from(productsTable)
        .where(inArray(productsTable.id, topProductIds));
      for (const p of products) {
        const url = p.imageUrl?.trim();
        if (url) {
          const catId = categoryForProduct.get(p.id);
          if (catId) fallbackByCategoryId.set(catId, url);
        }
      }
    }

    const stillNeed = needIds.filter((id) => !fallbackByCategoryId.has(id));
    if (stillNeed.length > 0) {
      const newestPerCategory = await db
        .select({
          categoryId: productCategoriesTable.categoryId,
          createdAt: productsTable.createdAt,
          productId: productCategoriesTable.productId,
        })
        .from(productCategoriesTable)
        .innerJoin(
          productsTable,
          eq(productCategoriesTable.productId, productsTable.id),
        )
        .where(
          and(
            inArray(productCategoriesTable.categoryId, stillNeed),
            eq(productsTable.published, true),
            eq(productsTable.hidden, false),
          ),
        )
        .orderBy(desc(productsTable.createdAt));

      const seenNew = new Set<string>();
      const newestProductIds: string[] = [];
      const categoryForNewest = new Map<string, string>();
      for (const row of newestPerCategory) {
        if (
          row.categoryId &&
          !seenNew.has(row.categoryId) &&
          row.productId &&
          !fallbackByCategoryId.has(row.categoryId)
        ) {
          seenNew.add(row.categoryId);
          newestProductIds.push(row.productId);
          categoryForNewest.set(row.productId, row.categoryId);
        }
      }
      if (newestProductIds.length > 0) {
        const products = await db
          .select({ id: productsTable.id, imageUrl: productsTable.imageUrl })
          .from(productsTable)
          .where(inArray(productsTable.id, newestProductIds));
        for (const p of products) {
          const url = p.imageUrl?.trim();
          if (url) {
            const catId = categoryForNewest.get(p.id);
            if (catId) fallbackByCategoryId.set(catId, url);
          }
        }
      }
    }
  }

  return categories
    .filter((c): c is typeof c & { slug: string } => c.slug != null)
    .map((c) => ({
      image:
        (c.imageUrl?.trim() && c.imageUrl) ||
        fallbackByCategoryId.get(c.id) ||
        undefined,
      name: c.name,
      slug: c.slug!,
    }));
}

/**
 * Get a category by slug (for category pages). Returns null if not found.
 */
export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryBySlug | null> {
  if (!slug?.trim()) return null;
  const [row] = await db
    .select({
      description: categoriesTable.description,
      id: categoriesTable.id,
      imageUrl: categoriesTable.imageUrl,
      metaDescription: categoriesTable.metaDescription,
      name: categoriesTable.name,
      parentId: categoriesTable.parentId,
      slug: categoriesTable.slug,
      title: categoriesTable.title,
      tokenGated: categoriesTable.tokenGated,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug.trim()))
    .limit(1);
  if (!row?.slug) return null;
  return {
    description: row.description ?? null,
    id: row.id,
    imageUrl: row.imageUrl ?? null,
    metaDescription: row.metaDescription ?? null,
    name: row.name,
    parentId: row.parentId ?? null,
    slug: row.slug,
    title: row.title ?? null,
    tokenGated: row.tokenGated ?? false,
  };
}

/**
 * Get a category's slug and name by id (for parent pill on category pages).
 */
export async function getCategoryParent(
  parentId: string,
): Promise<null | { name: string; slug: string }> {
  if (!parentId?.trim()) return null;
  const [row] = await db
    .select({
      name: categoriesTable.name,
      slug: categoriesTable.slug,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, parentId.trim()))
    .limit(1);
  if (!row?.slug) return null;
  return { name: row.name, slug: row.slug };
}

// Re-export from the lightweight client-safe module so server callers
// can keep importing from ~/lib/categories without changing imports.
export { sortSubcategories } from "~/lib/category-sort";

/**
 * Get the best product image for a category (for OG/social thumbnails).
 * Priority: most sold product image → newest product image.
 * Returns an absolute image URL or null.
 */
export async function getCategoryProductImage(
  categoryId: string,
): Promise<null | string> {
  if (!categoryId?.trim()) return null;
  try {
    // 1) Most popular (most sold) product in this category
    const [bestSeller] = await db
      .select({ imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .innerJoin(
        productCategoriesTable,
        eq(productsTable.id, productCategoriesTable.productId),
      )
      .leftJoin(
        orderItemsTable,
        eq(productsTable.id, orderItemsTable.productId),
      )
      .where(
        and(
          eq(productCategoriesTable.categoryId, categoryId),
          eq(productsTable.published, true),
          eq(productsTable.hidden, false),
          isNotNull(productsTable.imageUrl),
        ),
      )
      .groupBy(productsTable.id, productsTable.imageUrl)
      .orderBy(
        desc(sql`coalesce(sum(${orderItemsTable.quantity}), 0)`),
        desc(productsTable.createdAt),
      )
      .limit(1);
    if (bestSeller?.imageUrl) return bestSeller.imageUrl;

    // 2) Newest product in category (fallback if no sales data)
    const [newest] = await db
      .select({ imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .innerJoin(
        productCategoriesTable,
        eq(productsTable.id, productCategoriesTable.productId),
      )
      .where(
        and(
          eq(productCategoriesTable.categoryId, categoryId),
          eq(productsTable.published, true),
          eq(productsTable.hidden, false),
          isNotNull(productsTable.imageUrl),
        ),
      )
      .orderBy(desc(productsTable.createdAt))
      .limit(1);
    return newest?.imageUrl ?? null;
  } catch {
    return null;
  }
}

/** Category names/slugs treated as generic "all products" — breadcrumb prefers a more specific category when present. */
const GENERIC_CATEGORY_NAMES = new Set([
  "all products",
  "products",
  "all",
  "shop",
]);
const GENERIC_CATEGORY_SLUGS = new Set(["products", "all", "shop"]);

function isGenericCategory(name: string, slug: string | null): boolean {
  const n = name?.toLowerCase().trim() ?? "";
  const s = (slug?.toLowerCase().trim() ?? "").replace(/^\/+|\/+$/g, "");
  return GENERIC_CATEGORY_NAMES.has(n) || GENERIC_CATEGORY_SLUGS.has(s);
}

/**
 * Build the category chain (leaf to root) for a given category id.
 */
async function getCategoryChain(
  categoryId: string,
): Promise<{ id: string; name: string; parentId: null | string; slug: null | string }[]> {
  const chain: {
    id: string;
    name: string;
    parentId: null | string;
    slug: null | string;
  }[] = [];
  let currentId: null | string = categoryId;
  while (currentId) {
    const [row] = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        parentId: categoriesTable.parentId,
        slug: categoriesTable.slug,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, currentId))
      .limit(1);
    if (!row) break;
    chain.push(row);
    currentId = row.parentId;
  }
  return chain.reverse();
}

/**
 * Breadcrumb trail for a product page: Home > category > subcategory > product.
 * Uses the product's main category and its parent chain. If the main category is generic
 * (e.g. "All Products"), prefers another assigned category that is more specific so the
 * breadcrumb reflects where the product actually lives (e.g. Supplements).
 */
export async function getProductBreadcrumbTrail(
  productId: string,
  productName: string,
  productHref: string,
): Promise<BreadcrumbItem[]> {
  const home: BreadcrumbItem = { href: "/", name: "Home" };
  const productItem: BreadcrumbItem = { href: productHref, name: productName };

  const allPcs = await db
    .select({
      categoryId: productCategoriesTable.categoryId,
      isMain: productCategoriesTable.isMain,
    })
    .from(productCategoriesTable)
    .where(eq(productCategoriesTable.productId, productId));

  if (allPcs.length === 0) {
    return [home, productItem];
  }

  const mainPc = allPcs.find((pc) => pc.isMain);
  let chosenCategoryId: string | null =
    (mainPc?.categoryId ?? allPcs[0]?.categoryId) ?? null;
  if (!chosenCategoryId) return [home, productItem];

  const mainChain = await getCategoryChain(chosenCategoryId);
  const mainLeaf = mainChain[mainChain.length - 1];
  const mainIsGeneric =
    mainLeaf && isGenericCategory(mainLeaf.name, mainLeaf.slug ?? null);

  if (mainIsGeneric && allPcs.length > 1) {
    let bestChain: {
      id: string;
      name: string;
      parentId: null | string;
      slug: null | string;
    }[] = mainChain;
    for (const pc of allPcs) {
      if (!pc.categoryId || pc.categoryId === chosenCategoryId) continue;
      const chain = await getCategoryChain(pc.categoryId);
      const leaf = chain[chain.length - 1];
      if (!leaf || isGenericCategory(leaf.name, leaf.slug ?? null)) continue;
      if (chain.length >= bestChain.length) bestChain = chain;
    }
    const ordered = bestChain;
    const rootSlug =
      ordered[0]?.slug ??
      ordered[0]?.name?.toLowerCase().replace(/\s+/g, "-") ??
      "shop";
    const categoryItems: BreadcrumbItem[] = ordered.map((c, i) => {
      const slug =
        c.slug ??
        c.name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
      const href = i === 0 ? `/${slug}` : `/${rootSlug}?subcategory=${slug}`;
      return { href, name: c.name };
    });
    return [home, ...categoryItems, productItem];
  }

  const ordered = mainChain;
  const rootSlug =
    ordered[0]?.slug ??
    ordered[0]?.name?.toLowerCase().replace(/\s+/g, "-") ??
    "shop";
  const categoryItems: BreadcrumbItem[] = ordered.map((c, i) => {
    const slug =
      c.slug ??
      c.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const href = i === 0 ? `/${slug}` : `/${rootSlug}?subcategory=${slug}`;
    return { href, name: c.name };
  });
  return [home, ...categoryItems, productItem];
}

/**
 * Child categories of a given parent (for subcategory filter on category pages).
 * Only returns subcategories that have at least one published product.
 */
export async function getSubcategories(
  parentId: string,
): Promise<SubcategoryOption[]> {
  const rows = await db
    .select({
      categoryId: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.parentId, parentId))
    .orderBy(asc(categoriesTable.name));

  if (rows.length === 0) return [];

  const categoryIds = rows
    .map((r) => r.categoryId)
    .filter((id): id is string => id != null);
  if (categoryIds.length === 0) return [];

  const counts = await db
    .select({
      categoryId: productCategoriesTable.categoryId,
      count: sql<number>`count(distinct ${productCategoriesTable.productId})::int`,
    })
    .from(productCategoriesTable)
    .innerJoin(
      productsTable,
      eq(productCategoriesTable.productId, productsTable.id),
    )
    .where(
      and(
        inArray(productCategoriesTable.categoryId, categoryIds),
        eq(productsTable.published, true),
      ),
    )
    .groupBy(productCategoriesTable.categoryId);

  const countByCategoryId = new Map(counts.map((c) => [c.categoryId, c.count]));

  const filtered = rows
    .filter(
      (r): r is { categoryId: string; name: string; slug: string } =>
        r.slug != null && (countByCategoryId.get(r.categoryId) ?? 0) > 0,
    )
    .map((r) => ({ name: r.name, slug: r.slug }));

  return sortSubcategories(filtered);
}
