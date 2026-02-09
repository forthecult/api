import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, ilike, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  categoriesTable,
  categoryAutoAssignRuleTable,
  productCategoriesTable,
  productsTable,
  productTagsTable,
} from "~/db/schema";
import { getWholeWordRegexPattern } from "~/lib/category-auto-assign";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * POST /api/admin/categories/[id]/bulk-add-products
 * Body: { titleContains?: string, createdWithinDays?: number, brand?: string }
 * Adds all matching products to the category (as non-main). Skips products already in the category.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: categoryId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      titleContains?: string;
      createdWithinDays?: number;
      brand?: string;
      /** Product must have at least one tag containing this (case-insensitive). */
      tagContains?: string;
      /** If true, save these filters as a perpetual rule for new/imported products */
      perpetual?: boolean;
      /** If true, find products matching ANY of this category's saved perpetual rules and add them (backfill). */
      runPerpetualRules?: boolean;
    };

    const titleContains =
      typeof body.titleContains === "string" ? body.titleContains.trim() : "";
    const createdWithinDays =
      typeof body.createdWithinDays === "number" && body.createdWithinDays > 0
        ? body.createdWithinDays
        : null;
    const brand = typeof body.brand === "string" ? body.brand.trim() : null;
    const tagContains =
      typeof body.tagContains === "string" ? body.tagContains.trim() : null;
    const perpetual = body.perpetual === true;
    const runPerpetualRules = body.runPerpetualRules === true;

    const [category] = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    async function findProductIdsMatchingRule(opts: {
      titleContains: string;
      createdWithinDays: number | null;
      brand: string | null;
      tagContains: string | null;
    }): Promise<string[]> {
      const {
        titleContains: tc,
        createdWithinDays: cwd,
        brand: b,
        tagContains: tag,
      } = opts;
      const hasFilter =
        !!tc || cwd !== null || !!b || !!tag;
      if (!hasFilter) return [];

      const conditions = [eq(productsTable.published, true)];
      if (tc) {
        const pattern = getWholeWordRegexPattern(tc);
        if (pattern) {
          conditions.push(sql`${productsTable.name} ~* ${pattern}`);
        }
      }
      if (cwd !== null) {
        const since = new Date();
        since.setDate(since.getDate() - cwd);
        conditions.push(gte(productsTable.createdAt, since));
      }
      if (b) {
        conditions.push(ilike(productsTable.brand, b));
      }

      let rows = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(and(...conditions));

      if (tag) {
        const tagPattern = getWholeWordRegexPattern(tag);
        const productIdsWithTag =
          tagPattern
            ? await db
                .selectDistinct({ productId: productTagsTable.productId })
                .from(productTagsTable)
                .where(sql`${productTagsTable.tag} ~* ${tagPattern}`)
            : [];
        const ids = new Set(productIdsWithTag.map((r) => r.productId));
        rows = rows.filter((p) => ids.has(p.id));
      }
      return rows.map((r) => r.id);
    }

    let productIds: string[];

    if (runPerpetualRules) {
      const rules = await db
        .select()
        .from(categoryAutoAssignRuleTable)
        .where(
          and(
            eq(categoryAutoAssignRuleTable.categoryId, categoryId),
            eq(categoryAutoAssignRuleTable.enabled, true),
          ),
        );
      const allIds = new Set<string>();
      for (const rule of rules) {
        const hasFilter =
          !!rule.titleContains?.trim() ||
          rule.createdWithinDays != null ||
          !!rule.brand?.trim() ||
          !!rule.tagContains?.trim();
        if (!hasFilter) continue;
        const ids = await findProductIdsMatchingRule({
          titleContains: rule.titleContains?.trim() ?? "",
          createdWithinDays: rule.createdWithinDays,
          brand: rule.brand?.trim() ?? null,
          tagContains: rule.tagContains?.trim() ?? null,
        });
        ids.forEach((id) => allIds.add(id));
      }
      productIds = [...allIds];
    } else {
      if (
        !titleContains &&
        createdWithinDays === null &&
        !brand &&
        !tagContains
      ) {
        return NextResponse.json(
          {
            error:
              "Provide at least one filter, or runPerpetualRules: true to add products matching saved rules.",
          },
          { status: 400 },
        );
      }
      productIds = await findProductIdsMatchingRule({
        titleContains,
        createdWithinDays,
        brand,
        tagContains,
      });
    }

    if (perpetual) {
      const titleVal = titleContains || null;
      const brandVal = brand || null;
      const tagVal = tagContains || null;
      const existingRules = await db
        .select({
          titleContains: categoryAutoAssignRuleTable.titleContains,
          createdWithinDays: categoryAutoAssignRuleTable.createdWithinDays,
          brand: categoryAutoAssignRuleTable.brand,
          tagContains: categoryAutoAssignRuleTable.tagContains,
        })
        .from(categoryAutoAssignRuleTable)
        .where(eq(categoryAutoAssignRuleTable.categoryId, categoryId));
      const isDuplicate = existingRules.some(
        (r) =>
          (r.titleContains ?? null) === titleVal &&
          (r.createdWithinDays ?? null) === createdWithinDays &&
          (r.brand ?? null) === brandVal &&
          (r.tagContains ?? null) === tagVal,
      );
      if (!isDuplicate) {
        const now = new Date();
        await db.insert(categoryAutoAssignRuleTable).values({
          id: createId(),
          categoryId,
          titleContains: titleVal,
          createdWithinDays,
          brand: brandVal,
          tagContains: tagVal,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (productIds.length === 0) {
      return NextResponse.json({
        added: 0,
        skipped: 0,
        totalMatched: 0,
        perpetualSaved: perpetual,
        message:
          perpetual
            ? "No current products match. Perpetual rule saved—future products matching these filters will be added to this category."
            : "No products match the filters.",
      });
    }

    const existing = await db
      .select({ productId: productCategoriesTable.productId })
      .from(productCategoriesTable)
      .where(eq(productCategoriesTable.categoryId, categoryId));

    const existingSet = new Set(existing.map((r) => r.productId));
    const toAdd = productIds.filter((pid) => !existingSet.has(pid));

    for (const productId of toAdd) {
      await db
        .insert(productCategoriesTable)
        .values({
          productId,
          categoryId,
          isMain: false,
        })
        .onConflictDoNothing({
          target: [
            productCategoriesTable.productId,
            productCategoriesTable.categoryId,
          ],
        });
    }

    // Invalidate products list and category page so newly added products show
    revalidatePath("/api/products");
    revalidatePath("/products");
    const cat = await db
      .select({ slug: categoriesTable.slug })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);
    if (cat[0]?.slug) revalidatePath(`/${cat[0].slug}`);

    return NextResponse.json({
      added: toAdd.length,
      skipped: productIds.length - toAdd.length,
      totalMatched: productIds.length,
      perpetualSaved: perpetual,
      message:
        toAdd.length === 0
          ? "All matching products are already in this category."
          : `Added ${toAdd.length} product${toAdd.length === 1 ? "" : "s"} to the category.`,
    });
  } catch (err) {
    console.error("Bulk add products to category error:", err);
    return NextResponse.json(
      { error: "Failed to bulk add products" },
      { status: 500 },
    );
  }
}
