import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { addressesTable } from "~/db/schema";
import { auth } from "~/lib/auth";

/**
 * GET /api/user/addresses
 * Returns saved addresses for the authenticated user.
 * Returns [] for unauthenticated users (checkout is guest-friendly).
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ addresses: [] });
  }

  const rows = await db
    .select({
      address1: addressesTable.address1,
      address2: addressesTable.address2,
      city: addressesTable.city,
      countryCode: addressesTable.countryCode,
      id: addressesTable.id,
      isDefault: addressesTable.isDefault,
      label: addressesTable.label,
      phone: addressesTable.phone,
      stateCode: addressesTable.stateCode,
      zip: addressesTable.zip,
    })
    .from(addressesTable)
    .where(eq(addressesTable.userId, session.user.id))
    .orderBy(desc(addressesTable.createdAt));

  return NextResponse.json({
    addresses: rows.map((r) => ({
      address1: r.address1,
      address2: r.address2 ?? undefined,
      city: r.city,
      countryCode: r.countryCode,
      id: r.id,
      isDefault: r.isDefault,
      label: r.label ?? undefined,
      phone: r.phone ?? undefined,
      stateCode: r.stateCode ?? undefined,
      zip: r.zip,
    })),
  });
}

/**
 * POST /api/user/addresses
 * Create a new saved address for the authenticated user.
 * Body: { address1, address2?, city, stateCode?, countryCode, zip, phone?, label? }
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    address1?: string;
    address2?: string;
    city?: string;
    countryCode?: string;
    label?: string;
    phone?: string;
    stateCode?: string;
    zip?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const address1 =
    typeof body.address1 === "string" ? body.address1.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const countryCode =
    typeof body.countryCode === "string" ? body.countryCode.trim() : "";
  const zip = typeof body.zip === "string" ? body.zip.trim() : "";
  if (!address1 || !city || !countryCode || !zip) {
    return NextResponse.json(
      { error: "address1, city, countryCode, and zip are required" },
      { status: 400 },
    );
  }

  const existing = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.userId, session.user.id));
  const isDefault = existing.length === 0;

  const id = createId();
  const now = new Date();
  await db.insert(addressesTable).values({
    address1,
    address2:
      typeof body.address2 === "string" ? body.address2.trim() || null : null,
    city,
    countryCode,
    createdAt: now,
    id,
    isDefault,
    label: typeof body.label === "string" ? body.label.trim() || null : null,
    phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
    stateCode:
      typeof body.stateCode === "string" ? body.stateCode.trim() || null : null,
    updatedAt: now,
    userId: session.user.id,
    zip,
  });

  return NextResponse.json({ id });
}
