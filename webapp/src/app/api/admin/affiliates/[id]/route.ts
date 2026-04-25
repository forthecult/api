import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable, ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;

    const [affiliate] = await db
      .select({
        adminNote: affiliateTable.adminNote,
        applicationNote: affiliateTable.applicationNote,
        code: affiliateTable.code,
        commissionType: affiliateTable.commissionType,
        commissionValue: affiliateTable.commissionValue,
        createdAt: affiliateTable.createdAt,
        customerDiscountType: affiliateTable.customerDiscountType,
        customerDiscountValue: affiliateTable.customerDiscountValue,
        id: affiliateTable.id,
        payoutAddress: affiliateTable.payoutAddress,
        payoutMethod: affiliateTable.payoutMethod,
        status: affiliateTable.status,
        totalEarnedCents: affiliateTable.totalEarnedCents,
        totalPaidCents: affiliateTable.totalPaidCents,
        updatedAt: affiliateTable.updatedAt,
        userEmail: userTable.email,
        userId: affiliateTable.userId,
        userName: userTable.name,
      })
      .from(affiliateTable)
      .leftJoin(userTable, eq(affiliateTable.userId, userTable.id))
      .where(eq(affiliateTable.id, id))
      .limit(1);

    if (!affiliate) {
      return NextResponse.json(
        { error: "Affiliate not found" },
        { status: 404 },
      );
    }

    const [conversion] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(eq(ordersTable.affiliateId, id));

    return NextResponse.json({
      ...affiliate,
      conversionCount: conversion?.count ?? 0,
    });
  } catch (err) {
    console.error("Admin affiliate get error:", err);
    return NextResponse.json(
      { error: "Failed to load affiliate" },
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

    const [existing] = await db
      .select({ id: affiliateTable.id })
      .from(affiliateTable)
      .where(eq(affiliateTable.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "Affiliate not found" },
        { status: 404 },
      );
    }

    let body: {
      adminNote?: null | string;
      code?: string;
      commissionType?: string;
      commissionValue?: number;
      customerDiscountType?: null | string;
      customerDiscountValue?: null | number;
      payoutAddress?: null | string;
      payoutMethod?: null | string;
      status?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (
      typeof body.status === "string" &&
      ["approved", "pending", "rejected", "suspended"].includes(body.status)
    ) {
      updates.status = body.status;
    }
    if (typeof body.code === "string" && body.code.trim().length > 0) {
      updates.code = body.code.trim().toUpperCase().slice(0, 64);
    }
    if (
      typeof body.commissionType === "string" &&
      ["fixed", "percent"].includes(body.commissionType)
    ) {
      updates.commissionType = body.commissionType;
    }
    if (typeof body.commissionValue === "number" && body.commissionValue >= 0) {
      updates.commissionValue = body.commissionValue;
    }
    if (
      body.customerDiscountType === null ||
      body.customerDiscountType === undefined
    ) {
      updates.customerDiscountType = null;
      updates.customerDiscountValue = null;
    } else if (
      typeof body.customerDiscountType === "string" &&
      ["fixed", "percent"].includes(body.customerDiscountType)
    ) {
      updates.customerDiscountType = body.customerDiscountType;
      if (
        typeof body.customerDiscountValue === "number" &&
        body.customerDiscountValue >= 0
      ) {
        updates.customerDiscountValue = body.customerDiscountValue;
      }
    }
    if (body.adminNote !== undefined) {
      updates.adminNote =
        typeof body.adminNote === "string"
          ? body.adminNote.trim().slice(0, 2000)
          : null;
    }
    if (body.payoutMethod !== undefined) {
      updates.payoutMethod =
        typeof body.payoutMethod === "string"
          ? body.payoutMethod.trim().slice(0, 64)
          : null;
    }
    if (body.payoutAddress !== undefined) {
      updates.payoutAddress =
        typeof body.payoutAddress === "string"
          ? body.payoutAddress.trim().slice(0, 500)
          : null;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ updated: false });
    }

    await db
      .update(affiliateTable)
      .set(updates as Partial<typeof affiliateTable.$inferInsert>)
      .where(eq(affiliateTable.id, id));

    return NextResponse.json({ updated: true });
  } catch (err) {
    console.error("Admin affiliate patch error:", err);
    return NextResponse.json(
      { error: "Failed to update affiliate" },
      { status: 500 },
    );
  }
}
