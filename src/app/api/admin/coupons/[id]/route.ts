import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  couponCategoryTable,
  couponProductTable,
  couponRedemptionTable,
  couponsTable,
} from "~/db/schema";
import {
  adminAuthFailureResponse,
  getAdminAuth,
} from "~/lib/admin-api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    const [coupon] = await db
      .select({
        id: couponsTable.id,
        method: couponsTable.method,
        code: couponsTable.code,
        dateStart: couponsTable.dateStart,
        dateEnd: couponsTable.dateEnd,
        discountKind: couponsTable.discountKind,
        discountType: couponsTable.discountType,
        discountValue: couponsTable.discountValue,
        appliesTo: couponsTable.appliesTo,
        buyQuantity: couponsTable.buyQuantity,
        getQuantity: couponsTable.getQuantity,
        getDiscountType: couponsTable.getDiscountType,
        getDiscountValue: couponsTable.getDiscountValue,
        maxUses: couponsTable.maxUses,
        maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
        maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
        tokenHolderChain: couponsTable.tokenHolderChain,
        tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
        tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
        rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
        ruleSubtotalMinCents: couponsTable.ruleSubtotalMinCents,
        ruleSubtotalMaxCents: couponsTable.ruleSubtotalMaxCents,
        ruleShippingMinCents: couponsTable.ruleShippingMinCents,
        ruleShippingMaxCents: couponsTable.ruleShippingMaxCents,
        ruleProductCountMin: couponsTable.ruleProductCountMin,
        ruleProductCountMax: couponsTable.ruleProductCountMax,
        ruleOrderTotalMinCents: couponsTable.ruleOrderTotalMinCents,
        ruleOrderTotalMaxCents: couponsTable.ruleOrderTotalMaxCents,
        createdAt: couponsTable.createdAt,
        updatedAt: couponsTable.updatedAt,
      })
      .from(couponsTable)
      .where(eq(couponsTable.id, id))
      .limit(1);

    if (!coupon) {
      return NextResponse.json(
        { error: "Discount not found" },
        { status: 404 },
      );
    }

    const [categoryRows, productRows, redemptionCount] = await Promise.all([
      db
        .select({ categoryId: couponCategoryTable.categoryId })
        .from(couponCategoryTable)
        .where(eq(couponCategoryTable.couponId, id)),
      db
        .select({ productId: couponProductTable.productId })
        .from(couponProductTable)
        .where(eq(couponProductTable.couponId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(couponRedemptionTable)
        .where(eq(couponRedemptionTable.couponId, id)),
    ]);

    const redemptionTotal = redemptionCount[0]?.count ?? 0;

    return NextResponse.json({
      id: coupon.id,
      method: coupon.method ?? "code",
      code: coupon.code,
      dateStart: coupon.dateStart?.toISOString() ?? null,
      dateEnd: coupon.dateEnd?.toISOString() ?? null,
      discountKind: coupon.discountKind ?? "amount_off_order",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      appliesTo: coupon.appliesTo,
      buyQuantity: coupon.buyQuantity ?? null,
      getQuantity: coupon.getQuantity ?? null,
      getDiscountType: coupon.getDiscountType ?? null,
      getDiscountValue: coupon.getDiscountValue ?? null,
      maxUses: coupon.maxUses,
      maxUsesPerCustomer: coupon.maxUsesPerCustomer,
      maxUsesPerCustomerType: coupon.maxUsesPerCustomerType,
      tokenHolderChain: coupon.tokenHolderChain ?? null,
      tokenHolderTokenAddress: coupon.tokenHolderTokenAddress ?? null,
      tokenHolderMinBalance: coupon.tokenHolderMinBalance ?? null,
      rulePaymentMethodKey: coupon.rulePaymentMethodKey ?? null,
      ruleSubtotalMinCents: coupon.ruleSubtotalMinCents ?? null,
      ruleSubtotalMaxCents: coupon.ruleSubtotalMaxCents ?? null,
      ruleShippingMinCents: coupon.ruleShippingMinCents ?? null,
      ruleShippingMaxCents: coupon.ruleShippingMaxCents ?? null,
      ruleProductCountMin: coupon.ruleProductCountMin ?? null,
      ruleProductCountMax: coupon.ruleProductCountMax ?? null,
      ruleOrderTotalMinCents: coupon.ruleOrderTotalMinCents ?? null,
      ruleOrderTotalMaxCents: coupon.ruleOrderTotalMaxCents ?? null,
      categoryIds: categoryRows.map((r) => r.categoryId),
      productIds: productRows.map((r) => r.productId),
      redemptionCount: redemptionTotal,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Admin coupon get error:", err);
    return NextResponse.json(
      { error: "Failed to load discount" },
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

    const { id } = await params;
    const body = (await request.json()) as {
      method?: "automatic" | "code";
      code?: string;
      dateStart?: string | null;
      dateEnd?: string | null;
      discountKind?:
        | "amount_off_products"
        | "amount_off_order"
        | "buy_x_get_y"
        | "free_shipping";
      discountType?: "percent" | "fixed";
      discountValue?: number;
      appliesTo?: "subtotal" | "shipping";
      buyQuantity?: number | null;
      getQuantity?: number | null;
      getDiscountType?: "percent" | "fixed" | null;
      getDiscountValue?: number | null;
      maxUses?: number | null;
      maxUsesPerCustomer?: number | null;
      maxUsesPerCustomerType?: "account" | "phone" | "shipping_address" | null;
      tokenHolderChain?: string | null;
      tokenHolderTokenAddress?: string | null;
      tokenHolderMinBalance?: string | null;
      rulePaymentMethodKey?: string | null;
      categoryIds?: string[];
      productIds?: string[];
      ruleSubtotalMinCents?: number | null;
      ruleSubtotalMaxCents?: number | null;
      ruleShippingMinCents?: number | null;
      ruleShippingMaxCents?: number | null;
      ruleProductCountMin?: number | null;
      ruleProductCountMax?: number | null;
      ruleOrderTotalMinCents?: number | null;
      ruleOrderTotalMaxCents?: number | null;
    };

    const [existing] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Discount not found" },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.method === "automatic" || body.method === "code") {
      updates.method = body.method;
      if (body.method === "automatic") {
        updates.code = `AUTO-${id}`;
      } else if (typeof body.code === "string") {
        const codeRaw = body.code.trim().toUpperCase();
        if (codeRaw) updates.code = codeRaw;
      }
    } else if (typeof body.code === "string" && existing.method === "code") {
      const codeRaw = body.code.trim().toUpperCase();
      if (codeRaw) updates.code = codeRaw;
    }
    if (body.dateStart !== undefined)
      updates.dateStart = body.dateStart ? new Date(body.dateStart) : null;
    if (body.dateEnd !== undefined)
      updates.dateEnd = body.dateEnd ? new Date(body.dateEnd) : null;
    if (
      body.discountKind === "amount_off_products" ||
      body.discountKind === "amount_off_order" ||
      body.discountKind === "buy_x_get_y" ||
      body.discountKind === "free_shipping"
    ) {
      updates.discountKind = body.discountKind;
      updates.appliesTo =
        body.discountKind === "free_shipping"
          ? "shipping"
          : body.discountKind === "amount_off_products"
            ? "product"
            : "subtotal";
    }
    if (body.discountType !== undefined)
      updates.discountType = body.discountType;
    if (typeof body.discountValue === "number" && body.discountValue >= 0)
      updates.discountValue = Math.round(body.discountValue);
    if (body.appliesTo !== undefined) updates.appliesTo = body.appliesTo;
    if (body.buyQuantity !== undefined)
      updates.buyQuantity = body.buyQuantity ?? null;
    if (body.getQuantity !== undefined)
      updates.getQuantity = body.getQuantity ?? null;
    if (body.getDiscountType !== undefined)
      updates.getDiscountType = body.getDiscountType ?? null;
    if (body.getDiscountValue !== undefined)
      updates.getDiscountValue =
        body.getDiscountValue != null
          ? Math.round(body.getDiscountValue)
          : null;
    if (body.maxUses !== undefined) updates.maxUses = body.maxUses ?? null;
    if (body.maxUsesPerCustomer !== undefined)
      updates.maxUsesPerCustomer = body.maxUsesPerCustomer ?? null;
    if (body.maxUsesPerCustomerType !== undefined)
      updates.maxUsesPerCustomerType = body.maxUsesPerCustomerType ?? null;
    if (body.tokenHolderChain !== undefined)
      updates.tokenHolderChain = body.tokenHolderChain ?? null;
    if (body.tokenHolderTokenAddress !== undefined)
      updates.tokenHolderTokenAddress = body.tokenHolderTokenAddress ?? null;
    if (body.tokenHolderMinBalance !== undefined)
      updates.tokenHolderMinBalance = body.tokenHolderMinBalance ?? null;
    if (body.rulePaymentMethodKey !== undefined)
      updates.rulePaymentMethodKey = body.rulePaymentMethodKey ?? null;
    if (body.ruleSubtotalMinCents !== undefined)
      updates.ruleSubtotalMinCents = body.ruleSubtotalMinCents ?? null;
    if (body.ruleSubtotalMaxCents !== undefined)
      updates.ruleSubtotalMaxCents = body.ruleSubtotalMaxCents ?? null;
    if (body.ruleShippingMinCents !== undefined)
      updates.ruleShippingMinCents = body.ruleShippingMinCents ?? null;
    if (body.ruleShippingMaxCents !== undefined)
      updates.ruleShippingMaxCents = body.ruleShippingMaxCents ?? null;
    if (body.ruleProductCountMin !== undefined)
      updates.ruleProductCountMin = body.ruleProductCountMin ?? null;
    if (body.ruleProductCountMax !== undefined)
      updates.ruleProductCountMax = body.ruleProductCountMax ?? null;
    if (body.ruleOrderTotalMinCents !== undefined)
      updates.ruleOrderTotalMinCents = body.ruleOrderTotalMinCents ?? null;
    if (body.ruleOrderTotalMaxCents !== undefined)
      updates.ruleOrderTotalMaxCents = body.ruleOrderTotalMaxCents ?? null;

    await db
      .update(couponsTable)
      .set(updates as Record<string, unknown>)
      .where(eq(couponsTable.id, id));

    if (body.categoryIds !== undefined) {
      await db
        .delete(couponCategoryTable)
        .where(eq(couponCategoryTable.couponId, id));
      const categoryIds = [...new Set(body.categoryIds.filter(Boolean))];
      for (const categoryId of categoryIds) {
        await db
          .insert(couponCategoryTable)
          .values({ couponId: id, categoryId });
      }
    }

    if (body.productIds !== undefined) {
      await db
        .delete(couponProductTable)
        .where(eq(couponProductTable.couponId, id));
      const productIds = [...new Set(body.productIds.filter(Boolean))];
      for (const productId of productIds) {
        await db.insert(couponProductTable).values({ couponId: id, productId });
      }
    }

    const [updated] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.id, id))
      .limit(1);

    if (!updated) {
      return NextResponse.json(
        { error: "Discount not found" },
        { status: 404 },
      );
    }

    const [categoryRows, productRows] = await Promise.all([
      db
        .select({ categoryId: couponCategoryTable.categoryId })
        .from(couponCategoryTable)
        .where(eq(couponCategoryTable.couponId, id)),
      db
        .select({ productId: couponProductTable.productId })
        .from(couponProductTable)
        .where(eq(couponProductTable.couponId, id)),
    ]);

    return NextResponse.json({
      id: updated.id,
      method: updated.method ?? "code",
      code: updated.code,
      dateStart: updated.dateStart?.toISOString() ?? null,
      dateEnd: updated.dateEnd?.toISOString() ?? null,
      discountKind: updated.discountKind ?? "amount_off_order",
      discountType: updated.discountType,
      discountValue: updated.discountValue,
      appliesTo: updated.appliesTo,
      buyQuantity: updated.buyQuantity ?? null,
      getQuantity: updated.getQuantity ?? null,
      getDiscountType: updated.getDiscountType ?? null,
      getDiscountValue: updated.getDiscountValue ?? null,
      maxUses: updated.maxUses,
      maxUsesPerCustomer: updated.maxUsesPerCustomer,
      maxUsesPerCustomerType: updated.maxUsesPerCustomerType,
      rulePaymentMethodKey: updated.rulePaymentMethodKey ?? null,
      ruleSubtotalMinCents: updated.ruleSubtotalMinCents ?? null,
      ruleSubtotalMaxCents: updated.ruleSubtotalMaxCents ?? null,
      ruleShippingMinCents: updated.ruleShippingMinCents ?? null,
      ruleShippingMaxCents: updated.ruleShippingMaxCents ?? null,
      ruleProductCountMin: updated.ruleProductCountMin ?? null,
      ruleProductCountMax: updated.ruleProductCountMax ?? null,
      ruleOrderTotalMinCents: updated.ruleOrderTotalMinCents ?? null,
      ruleOrderTotalMaxCents: updated.ruleOrderTotalMaxCents ?? null,
      categoryIds: categoryRows.map((r) => r.categoryId),
      productIds: productRows.map((r) => r.productId),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error("Admin discount update error:", err);
    return NextResponse.json(
      { error: "Failed to update discount" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;

    const [deleted] = await db
      .delete(couponsTable)
      .where(eq(couponsTable.id, id))
      .returning({ id: couponsTable.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Discount not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin discount delete error:", err);
    return NextResponse.json(
      { error: "Failed to delete discount" },
      { status: 500 },
    );
  }
}
