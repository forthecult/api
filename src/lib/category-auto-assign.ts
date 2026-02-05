/**
 * Perpetual category auto-assign: when a product is created/imported/updated,
 * run enabled rules to add the product to matching categories and remove it
 * from categories it no longer matches.
 */

import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import {
  categoryAutoAssignRuleTable,
  productCategoriesTable,
  productTagsTable,
} from "~/db/schema";

export interface ProductForAutoAssign {
  id: string;
  name: string;
  brand: string | null;
  createdAt: Date;
  /** Product tags (for tagContains rule). If not provided, tag-based rules do not match. */
  tags?: string[];
}

function productMatchesRule(
  product: ProductForAutoAssign,
  rule: {
    titleContains: string | null;
    createdWithinDays: number | null;
    brand: string | null;
    tagContains: string | null;
  },
): boolean {
  if (rule.titleContains?.trim()) {
    if (
      !product.name ||
      !product.name
        .toLowerCase()
        .includes(rule.titleContains.trim().toLowerCase())
    ) {
      return false;
    }
  }
  if (rule.brand?.trim()) {
    if (
      !product.brand ||
      product.brand.trim().toLowerCase() !== rule.brand.trim().toLowerCase()
    ) {
      return false;
    }
  }
  if (rule.tagContains?.trim()) {
    const needle = rule.tagContains.trim().toLowerCase();
    const tags = product.tags ?? [];
    if (
      !tags.some((t) =>
        String(t).trim().toLowerCase().includes(needle),
      )
    ) {
      return false;
    }
  }
  if (rule.createdWithinDays != null && rule.createdWithinDays > 0) {
    const since = new Date();
    since.setDate(since.getDate() - rule.createdWithinDays);
    if (product.createdAt < since) return false;
  }
  if (
    !rule.titleContains?.trim() &&
    rule.createdWithinDays == null &&
    !rule.brand?.trim() &&
    !rule.tagContains?.trim()
  ) {
    return false;
  }
  return true;
}

/**
 * Run all enabled auto-assign rules for a product and add it to matching categories.
 * Skips if product is already in the category.
 */
export async function applyCategoryAutoRules(
  product: ProductForAutoAssign,
): Promise<{ added: number }> {
  const rules = await db
    .select()
    .from(categoryAutoAssignRuleTable)
    .where(eq(categoryAutoAssignRuleTable.enabled, true));

  if (rules.length === 0) return { added: 0 };

  const needsTags = rules.some((r) => r.tagContains?.trim());
  let tags = product.tags;
  if (needsTags && tags === undefined) {
    const rows = await db
      .select({ tag: productTagsTable.tag })
      .from(productTagsTable)
      .where(eq(productTagsTable.productId, product.id));
    tags = rows.map((r) => r.tag);
  }
  const productWithTags = { ...product, tags };

  const matchingCategoryIds: string[] = [];
  for (const rule of rules) {
    if (productMatchesRule(productWithTags, rule)) {
      matchingCategoryIds.push(rule.categoryId);
    }
  }

  const uniqueIds = [...new Set(matchingCategoryIds)];
  let added = 0;
  for (const categoryId of uniqueIds) {
    await db
      .insert(productCategoriesTable)
      .values({
        productId: product.id,
        categoryId,
        isMain: false,
      })
      .onConflictDoNothing({
        target: [
          productCategoriesTable.productId,
          productCategoriesTable.categoryId,
        ],
      });
    added += 1;
  }
  return { added };
}

/**
 * Sync a product's category membership with all perpetual auto-assign rules.
 * Call when a product is updated (e.g. name or brand changed): adds the product
 * to categories it now matches and removes it from categories it no longer matches.
 */
export async function syncProductCategoriesWithAutoRules(
  product: ProductForAutoAssign,
): Promise<{ added: number; removed: number }> {
  const rules = await db
    .select()
    .from(categoryAutoAssignRuleTable)
    .where(eq(categoryAutoAssignRuleTable.enabled, true));

  if (rules.length === 0) return { added: 0, removed: 0 };

  const needsTags = rules.some((r) => r.tagContains?.trim());
  let tags = product.tags;
  if (needsTags && tags === undefined) {
    const rows = await db
      .select({ tag: productTagsTable.tag })
      .from(productTagsTable)
      .where(eq(productTagsTable.productId, product.id));
    tags = rows.map((r) => r.tag);
  }
  const productWithTags = { ...product, tags };

  let added = 0;
  let removed = 0;

  for (const rule of rules) {
    const matches = productMatchesRule(productWithTags, rule);
    if (matches) {
      const result = await db
        .insert(productCategoriesTable)
        .values({
          productId: product.id,
          categoryId: rule.categoryId,
          isMain: false,
        })
        .onConflictDoNothing({
          target: [
            productCategoriesTable.productId,
            productCategoriesTable.categoryId,
          ],
        })
        .returning({ productId: productCategoriesTable.productId });
      if (result.length > 0) added += 1;
    } else {
      const result = await db
        .delete(productCategoriesTable)
        .where(
          and(
            eq(productCategoriesTable.productId, product.id),
            eq(productCategoriesTable.categoryId, rule.categoryId),
          ),
        )
        .returning({ productId: productCategoriesTable.productId });
      if (result.length > 0) removed += 1;
    }
  }

  return { added, removed };
}
