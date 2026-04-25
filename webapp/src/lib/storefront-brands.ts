import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "~/db";
import { brandTable, productsTable } from "~/db/schema";
import { slugify } from "~/lib/slugify";

/**
 * Resolve a URL slug to the exact `product.brand` string used in the catalog.
 * Curated rows in `brand` win; otherwise match a published product brand whose
 * slugified name equals `slug`.
 */
export async function resolveStorefrontBrandNameFromSlug(
  slug: string,
): Promise<null | string> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const [curated] = await db
    .select({ name: brandTable.name })
    .from(brandTable)
    .where(eq(brandTable.slug, s))
    .limit(1);
  if (curated?.name?.trim()) return curated.name.trim();

  const productBrands = await db
    .selectDistinct({ brand: productsTable.brand })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.published, true),
        eq(productsTable.hidden, false),
        isNotNull(productsTable.brand),
      ),
    );

  for (const row of productBrands) {
    const name = String(row.brand ?? "").trim();
    if (!name) continue;
    if (slugify(name) === s) return name;
  }

  return null;
}
