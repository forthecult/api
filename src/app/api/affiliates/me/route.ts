import { and, eq, ne, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable, ordersTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const ALLOWED_PAYOUT_METHODS = ["paypal", "bitcoin", "usdt", "cult"] as const;

const CODE_MIN_LENGTH = 4;
const CODE_MAX_LENGTH = 24;
const CODE_REGEX = /^[A-Za-z0-9]+$/;

function normalizeCode(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

/**
 * GET /api/affiliates/me
 * Returns current user's affiliate record (if any) and stats.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [affiliate] = await db
    .select({
      id: affiliateTable.id,
      code: affiliateTable.code,
      status: affiliateTable.status,
      commissionType: affiliateTable.commissionType,
      commissionValue: affiliateTable.commissionValue,
      totalEarnedCents: affiliateTable.totalEarnedCents,
      totalPaidCents: affiliateTable.totalPaidCents,
      applicationNote: affiliateTable.applicationNote,
      payoutMethod: affiliateTable.payoutMethod,
      payoutAddress: affiliateTable.payoutAddress,
      createdAt: affiliateTable.createdAt,
    })
    .from(affiliateTable)
    .where(eq(affiliateTable.userId, userId))
    .limit(1);

  if (!affiliate) {
    return NextResponse.json({ affiliate: null });
  }

  const [conversionCount] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.affiliateId, affiliate.id));

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://forthecult.store";
  const referralUrl =
    affiliate.status === "approved"
      ? `${baseUrl.replace(/\/$/, "")}?ref=${encodeURIComponent(affiliate.code)}`
      : null;

  return NextResponse.json({
    affiliate: {
      ...affiliate,
      conversionCount: conversionCount?.count ?? 0,
      referralUrl,
    },
  });
}

/**
 * PATCH /api/affiliates/me
 * Body: { code?: string, payoutMethod?: string, payoutAddress?: string }
 * Updates current user's affiliate code and/or payout settings.
 * Changing the code invalidates the previous referral link.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [affiliate] = await db
    .select({ id: affiliateTable.id, code: affiliateTable.code })
    .from(affiliateTable)
    .where(eq(affiliateTable.userId, userId))
    .limit(1);

  if (!affiliate) {
    return NextResponse.json(
      { error: "You are not an affiliate. Apply first." },
      { status: 404 },
    );
  }

  let body: { code?: string; payoutMethod?: string; payoutAddress?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: {
    code?: string;
    payoutMethod?: string | null;
    payoutAddress?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if ("code" in body && typeof body.code === "string") {
    const rawCode = body.code.trim();
    if (rawCode.length === 0) {
      return NextResponse.json(
        { error: "Code cannot be empty." },
        { status: 400 },
      );
    }
    const normalized = normalizeCode(rawCode);
    if (
      normalized.length < CODE_MIN_LENGTH ||
      normalized.length > CODE_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Code must be ${CODE_MIN_LENGTH}–${CODE_MAX_LENGTH} characters.`,
        },
        { status: 400 },
      );
    }
    if (!CODE_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Code can only contain letters and numbers." },
        { status: 400 },
      );
    }
    if (normalized !== affiliate.code) {
      const [collision] = await db
        .select({ id: affiliateTable.id })
        .from(affiliateTable)
        .where(eq(affiliateTable.code, normalized))
        .limit(1);
      if (collision) {
        return NextResponse.json(
          { error: "This code is already taken. Please choose another." },
          { status: 400 },
        );
      }
      updates.code = normalized;
    }
  }

  if ("payoutMethod" in body) {
    const raw =
      typeof body.payoutMethod === "string"
        ? body.payoutMethod.trim().toLowerCase()
        : "";
    if (raw === "") {
      updates.payoutMethod = null;
    } else if (
      ALLOWED_PAYOUT_METHODS.includes(
        raw as (typeof ALLOWED_PAYOUT_METHODS)[number],
      )
    ) {
      updates.payoutMethod = raw;
    } else {
      return NextResponse.json(
        { error: "Invalid payout method. Use paypal, bitcoin, usdt, or cult." },
        { status: 400 },
      );
    }
  }
  if ("payoutAddress" in body) {
    updates.payoutAddress =
      typeof body.payoutAddress === "string"
        ? body.payoutAddress.trim().slice(0, 500) || null
        : null;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .update(affiliateTable)
    .set(updates)
    .where(eq(affiliateTable.id, affiliate.id));

  const message = updates.code
    ? "Referral code updated. Your previous link no longer works."
    : "Payout settings updated.";
  return NextResponse.json({
    ok: true,
    message,
    ...(updates.code && { code: updates.code }),
  });
}
