import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { affiliateTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const CODE_MIN_LENGTH = 4;
const CODE_MAX_LENGTH = 24;
const CODE_REGEX = /^[A-Za-z0-9]+$/;

function generateAffiliateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Normalize user-chosen code: uppercase, no spaces. */
function normalizeCode(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

/**
 * POST /api/affiliates/apply
 * Body: { code?: string, applicationNote?: string, payoutMethod?: string, payoutAddress?: string }
 * Creates a pending affiliate application for the current user.
 * Optional code: 4–24 chars, letters and numbers only; must be unique. If omitted, a random code is generated.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [existing] = await db
    .select({
      id: affiliateTable.id,
      code: affiliateTable.code,
      status: affiliateTable.status,
    })
    .from(affiliateTable)
    .where(eq(affiliateTable.userId, userId))
    .limit(1);

  if (existing) {
    return NextResponse.json({
      id: existing.id,
      code: existing.code,
      status: existing.status,
      message: "You already have an affiliate application.",
    });
  }

  let body: {
    code?: string;
    applicationNote?: string;
    payoutMethod?: string;
    payoutAddress?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawCode =
    typeof body.code === "string" ? body.code.trim() : "";
  let code: string;

  if (rawCode.length > 0) {
    const normalized = normalizeCode(rawCode);
    if (normalized.length < CODE_MIN_LENGTH || normalized.length > CODE_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Code must be ${CODE_MIN_LENGTH}–${CODE_MAX_LENGTH} characters.` },
        { status: 400 },
      );
    }
    if (!CODE_REGEX.test(normalized)) {
      return NextResponse.json(
        { error: "Code can only contain letters and numbers." },
        { status: 400 },
      );
    }
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
    code = normalized;
  } else {
    code = generateAffiliateCode();
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      const [collision] = await db
        .select({ id: affiliateTable.id })
        .from(affiliateTable)
        .where(eq(affiliateTable.code, code))
        .limit(1);
      if (!collision) break;
      code = generateAffiliateCode();
    }
  }

  const applicationNote =
    typeof body.applicationNote === "string"
      ? body.applicationNote.trim().slice(0, 2000)
      : null;
  const rawPayoutMethod =
    typeof body.payoutMethod === "string" ? body.payoutMethod.trim().toLowerCase() : "";
  const allowedPayout = ["paypal", "bitcoin", "usdt", "cult"] as const;
  const payoutMethod =
    rawPayoutMethod === ""
      ? null
      : allowedPayout.includes(rawPayoutMethod as (typeof allowedPayout)[number])
        ? rawPayoutMethod
        : null;
  const payoutAddress =
    typeof body.payoutAddress === "string"
      ? body.payoutAddress.trim().slice(0, 500)
      : null;

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.insert(affiliateTable).values({
      id,
      userId,
      code,
      status: "pending",
      commissionType: "percent",
      commissionValue: 10,
      customerDiscountType: null,
      customerDiscountValue: null,
      applicationNote,
      adminNote: null,
      payoutMethod,
      payoutAddress,
      totalEarnedCents: 0,
      totalPaidCents: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (insertErr: unknown) {
    // Handle unique constraint violation (race condition on code)
    const code23505 =
      typeof insertErr === "object" &&
      insertErr !== null &&
      "code" in insertErr &&
      (insertErr as { code: string }).code === "23505";
    if (code23505) {
      return NextResponse.json(
        { error: "This code is already taken. Please choose another or retry." },
        { status: 409 },
      );
    }
    throw insertErr;
  }

  return NextResponse.json({
    id,
    code,
    status: "pending",
    message:
      "Your application has been submitted. We'll review it and get back to you.",
  });
}
