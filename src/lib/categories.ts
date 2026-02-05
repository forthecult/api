/**
 * Category helpers for storefront: lookup by slug, list slugs, breadcrumbs.
 */

import { and, asc, eq, isNotNull } from "drizzle-orm";

import { db } from "~/db";
import { categoriesTable, productCategoriesTable } from "~/db/schema";

export type CategoryBySlug = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  description: string | null;
  parentId: string | null;
};

/**
 * Get a category by slug (for category pages). Returns null if not found.
 */
export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryBySlug | null> {
  if (!slug?.trim()) return null;
  const [row] = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      title: categoriesTable.title,
      description: categoriesTable.description,
      parentId: categoriesTable.parentId,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, slug.trim()))
    .limit(1);
  if (!row?.slug) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    title: row.title ?? null,
    description: row.description ?? null,
    parentId: row.parentId ?? null,
  };
}

/**
 * Get a category's slug and name by id (for parent pill on category pages).
 */
export async function getCategoryParent(
  parentId: string,
): Promise<{ slug: string; name: string } | null> {
  if (!parentId?.trim()) return null;
  const [row] = await db
    .select({
      slug: categoriesTable.slug,
      name: categoriesTable.name,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, parentId.trim()))
    .limit(1);
  if (!row?.slug) return null;
  return { slug: row.slug, name: row.name };
}

/**
 * All category slugs and names (for filter dropdown and URL validation).
 * Includes categories with no products so every category has a page.
 */
export async function getAllCategorySlugsAndNames(): Promise<
  Array<{ slug: string; name: string }>
> {
  const rows = await db
    .select({
      slug: categoriesTable.slug,
      name: categoriesTable.name,
    })
    .from(categoriesTable)
    .where(isNotNull(categoriesTable.slug))
    .orderBy(asc(categoriesTable.name));
  return rows
    .filter((r): r is { slug: string; name: string } => r.slug != null)
    .map((r) => ({ slug: r.slug!, name: r.name }));
}

export type SubcategoryOption = { slug: string; name: string };

/**
 * Child categories of a given parent (for subcategory filter on category pages).
 */
export async function getSubcategories(
  parentId: string,
): Promise<SubcategoryOption[]> {
  const rows = await db
    .select({
      slug: categoriesTable.slug,
      name: categoriesTable.name,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.parentId, parentId))
    .orderBy(asc(categoriesTable.name));
  return rows
    .filter((r): r is { slug: string; name: string } => r.slug != null)
    .map((r) => ({ slug: r.slug!, name: r.name }));
}

export type BreadcrumbItem = { name: string; href: string };

/**
 * Breadcrumb trail for a product page: Home > category > subcategory > product.
 * Uses the product's main category and its parent chain. If no category, returns Home > product.
 */
export async function getProductBreadcrumbTrail(
  productId: string,
  productName: string,
  productHref: string,
): Promise<BreadcrumbItem[]> {
  const [mainPc] = await db
    .select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable)
    .where(
      and(
        eq(productCategoriesTable.productId, productId),
        eq(productCategoriesTable.isMain, true),
      ),
    )
    .limit(1);

  const home: BreadcrumbItem = { name: "Home", href: "/" };
  const productItem: BreadcrumbItem = { name: productName, href: productHref };

  if (!mainPc?.categoryId) {
    return [home, productItem];
  }

  const chain: Array<{ id: string; name: string; slug: string | null; parentId: string | null }> = [];
  let currentId: string | null = mainPc.categoryId;

  while (currentId) {
    const [row] = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        parentId: categoriesTable.parentId,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, currentId))
      .limit(1);
    if (!row) break;
    chain.push(row);
    currentId = row.parentId;
  }

  const ordered = chain.reverse();
  const rootSlug = ordered[0]?.slug ?? ordered[0]?.name?.toLowerCase().replace(/\s+/g, "-") ?? "shop";

  const categoryItems: BreadcrumbItem[] = ordered.map((c, i) => {
    const slug = c.slug ?? c.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const href = i === 0 ? `/${slug}` : `/${rootSlug}?subcategory=${slug}`;
    return { name: c.name, href };
  });

  return [home, ...categoryItems, productItem];
}
