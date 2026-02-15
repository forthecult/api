import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import {
  couponCategoryTable,
  couponProductTable,
  couponRedemptionTable,
  couponsTable,
} from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

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
        appliesTo: couponsTable.appliesTo,
        buyQuantity: couponsTable.buyQuantity,
        code: couponsTable.code,
        createdAt: couponsTable.createdAt,
        dateEnd: couponsTable.dateEnd,
        dateStart: couponsTable.dateStart,
        discountKind: couponsTable.discountKind,
        discountType: couponsTable.discountType,
        discountValue: couponsTable.discountValue,
        getDiscountType: couponsTable.getDiscountType,
        getDiscountValue: couponsTable.getDiscountValue,
        getQuantity: couponsTable.getQuantity,
        id: couponsTable.id,
        label: couponsTable.label,
        maxUses: couponsTable.maxUses,
        maxUsesPerCustomer: couponsTable.maxUsesPerCustomer,
        maxUsesPerCustomerType: couponsTable.maxUsesPerCustomerType,
        method: couponsTable.method,
        ruleAppliesToEsim: couponsTable.ruleAppliesToEsim,
        ruleOrderTotalMaxCents: couponsTable.ruleOrderTotalMaxCents,
        ruleOrderTotalMinCents: couponsTable.ruleOrderTotalMinCents,
        rulePaymentMethodKey: couponsTable.rulePaymentMethodKey,
        ruleProductCountMax: couponsTable.ruleProductCountMax,
        ruleProductCountMin: couponsTable.ruleProductCountMin,
        ruleShippingMaxCents: couponsTable.ruleShippingMaxCents,
        ruleShippingMinCents: couponsTable.ruleShippingMinCents,
        ruleSubtotalMaxCents: couponsTable.ruleSubtotalMaxCents,
        ruleSubtotalMinCents: couponsTable.ruleSubtotalMinCents,
        tokenHolderChain: couponsTable.tokenHolderChain,
        tokenHolderMinBalance: couponsTable.tokenHolderMinBalance,
        tokenHolderTokenAddress: couponsTable.tokenHolderTokenAddress,
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
      appliesTo: coupon.appliesTo,
      buyQuantity: coupon.buyQuantity ?? null,
      categoryIds: categoryRows.map((r) => r.categoryId),
      code: coupon.code,
      createdAt: coupon.createdAt.toISOString(),
      dateEnd: coupon.dateEnd?.toISOString() ?? null,
      dateStart: coupon.dateStart?.toISOString() ?? null,
      discountKind: coupon.discountKind ?? "amount_off_order",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      getDiscountType: coupon.getDiscountType ?? null,
      getDiscountValue: coupon.getDiscountValue ?? null,
      getQuantity: coupon.getQuantity ?? null,
      id: coupon.id,
      label: coupon.label ?? null,
      maxUses: coupon.maxUses,
      maxUsesPerCustomer: coupon.maxUsesPerCustomer,
      maxUsesPerCustomerType: coupon.maxUsesPerCustomerType,
      method: coupon.method ?? "code",
      productIds: productRows.map((r) => r.productId),
      redemptionCount: redemptionTotal,
      ruleAppliesToEsim: coupon.ruleAppliesToEsim ?? null,
      ruleOrderTotalMaxCents: coupon.ruleOrderTotalMaxCents ?? null,
      ruleOrderTotalMinCents: coupon.ruleOrderTotalMinCents ?? null,
      rulePaymentMethodKey: coupon.rulePaymentMethodKey ?? null,
      ruleProductCountMax: coupon.ruleProductCountMax ?? null,
      ruleProductCountMin: coupon.ruleProductCountMin ?? null,
      ruleShippingMaxCents: coupon.ruleShippingMaxCents ?? null,
      ruleShippingMinCents: coupon.ruleShippingMinCents ?? null,
      ruleSubtotalMaxCents: coupon.ruleSubtotalMaxCents ?? null,
      ruleSubtotalMinCents: coupon.ruleSubtotalMinCents ?? null,
      tokenHolderChain: coupon.tokenHolderChain ?? null,
      tokenHolderMinBalance: coupon.tokenHolderMinBalance ?? null,
      tokenHolderTokenAddress: coupon.tokenHolderTokenAddress ?? null,
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
      appliesTo?: "shipping" | "subtotal";
      buyQuantity?: null | number;
      categoryIds?: string[];
      code?: string;
      dateEnd?: null | string;
      dateStart?: null | string;
      discountKind?:
        | "amount_off_order"
        | "amount_off_products"
        | "buy_x_get_y"
        | "free_shipping";
      discountType?: "fixed" | "percent";
      discountValue?: number;
      getDiscountType?: "fixed" | "percent" | null;
      getDiscountValue?: null | number;
      getQuantity?: null | number;
      label?: null | string;
      maxUses?: null | number;
      maxUsesPerCustomer?: null | number;
      maxUsesPerCustomerType?: "account" | "phone" | "shipping_address" | null;
      method?: "automatic" | "code";
      productIds?: string[];
      ruleAppliesToEsim?: null | number;
      ruleOrderTotalMaxCents?: null | number;
      ruleOrderTotalMinCents?: null | number;
      rulePaymentMethodKey?: null | string;
      ruleProductCountMax?: null | number;
      ruleProductCountMin?: null | number;
      ruleShippingMaxCents?: null | number;
      ruleShippingMinCents?: null | number;
      ruleSubtotalMaxCents?: null | number;
      ruleSubtotalMinCents?: null | number;
      tokenHolderChain?: null | string;
      tokenHolderMinBalance?: null | string;
      tokenHolderTokenAddress?: null | string;
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
    if (body.label !== undefined) {
      updates.label =
        typeof body.label === "string" && body.label.trim().length > 0
          ? body.label.trim()
          : null;
    }
    if (body.ruleAppliesToEsim !== undefined) {
      updates.ruleAppliesToEsim = body.ruleAppliesToEsim === 1 ? 1 : null;
    }
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
          .values({ categoryId, couponId: id });
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
      appliesTo: updated.appliesTo,
      buyQuantity: updated.buyQuantity ?? null,
      categoryIds: categoryRows.map((r) => r.categoryId),
      code: updated.code,
      createdAt: updated.createdAt.toISOString(),
      dateEnd: updated.dateEnd?.toISOString() ?? null,
      dateStart: updated.dateStart?.toISOString() ?? null,
      discountKind: updated.discountKind ?? "amount_off_order",
      discountType: updated.discountType,
      discountValue: updated.discountValue,
      getDiscountType: updated.getDiscountType ?? null,
      getDiscountValue: updated.getDiscountValue ?? null,
      getQuantity: updated.getQuantity ?? null,
      id: updated.id,
      maxUses: updated.maxUses,
      maxUsesPerCustomer: updated.maxUsesPerCustomer,
      maxUsesPerCustomerType: updated.maxUsesPerCustomerType,
      method: updated.method ?? "code",
      productIds: productRows.map((r) => r.productId),
      ruleOrderTotalMaxCents: updated.ruleOrderTotalMaxCents ?? null,
      ruleOrderTotalMinCents: updated.ruleOrderTotalMinCents ?? null,
      rulePaymentMethodKey: updated.rulePaymentMethodKey ?? null,
      ruleProductCountMax: updated.ruleProductCountMax ?? null,
      ruleProductCountMin: updated.ruleProductCountMin ?? null,
      ruleShippingMaxCents: updated.ruleShippingMaxCents ?? null,
      ruleShippingMinCents: updated.ruleShippingMinCents ?? null,
      ruleSubtotalMaxCents: updated.ruleSubtotalMaxCents ?? null,
      ruleSubtotalMinCents: updated.ruleSubtotalMinCents ?? null,
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
