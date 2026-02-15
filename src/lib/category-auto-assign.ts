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
  brand: null | string;
  createdAt: Date;
  id: string;
  name: string;
  /** Product tags (for tagContains rule). If not provided, tag-based rules do not match. */
  tags?: string[];
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
        categoryId,
        isMain: false,
        productId: product.id,
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
 * Returns a PostgreSQL regex pattern for whole-word match (case-insensitive with ~*).
 * Uses \m and \M for word boundaries. Use in SQL: column ~* pattern
 */
export function getWholeWordRegexPattern(needle: string): string {
  const trimmed = needle.trim();
  if (!trimmed) return "";
  const escaped = escapeForRegex(trimmed);
  return `\\m${escaped}\\M`;
}

/**
 * Sync a product's category membership with all perpetual auto-assign rules.
 * Call when a product is updated (e.g. name or brand changed): adds the product
 * to categories it now matches and removes it from categories it no longer matches.
 * @param preserveCategoryIds - If provided, do not remove the product from these
 *   category IDs (e.g. when the user just explicitly assigned them in admin).
 */
export async function syncProductCategoriesWithAutoRules(
  product: ProductForAutoAssign,
  preserveCategoryIds?: string[],
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
          categoryId: rule.categoryId,
          isMain: false,
          productId: product.id,
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
      if (preserveCategoryIds?.includes(rule.categoryId)) continue;
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

/**
 * True if haystack contains needle as a whole word (case-insensitive).
 * E.g. "ton" matches "TON" or "Ton" in "buy Ton" but not in "cotton" or "button".
 */
function containsWholeWord(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) return false;
  const escaped = escapeForRegex(trimmed);
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(haystack);
}

/**
 * Escapes a string for use inside a regex (so literal match, no special chars).
 */
function escapeForRegex(needle: string): string {
  return needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match is case-insensitive for title and tag (e.g. "Bitcoin" and "bitcoin" match the same).
 * Title and tag "contains" use whole-word matching so e.g. "ton" does not match "cotton".
 */
function productMatchesRule(
  product: ProductForAutoAssign,
  rule: {
    brand: null | string;
    createdWithinDays: null | number;
    tagContains: null | string;
    titleContains: null | string;
  },
): boolean {
  if (rule.titleContains?.trim()) {
    if (
      !product.name ||
      !containsWholeWord(product.name, rule.titleContains.trim())
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
    const needle = rule.tagContains.trim();
    const tags = product.tags ?? [];
    if (!tags.some((t) => containsWholeWord(String(t).trim(), needle))) {
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
