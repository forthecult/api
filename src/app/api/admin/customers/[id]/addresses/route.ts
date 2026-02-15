import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { addressesTable } from "~/db/schema";
import { addCorsIfAdminOrigin } from "~/lib/cors-admin";
import { getAdminAuth } from "~/lib/admin-api-auth";

/**
 * OPTIONS for CORS preflight when admin app (different origin) calls this API.
 */
export async function OPTIONS(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return addCorsIfAdminOrigin(request, res);
}

/**
 * POST /api/admin/customers/[id]/addresses
 * Create an address for the customer (admin only).
 * Body: address1, address2?, city, stateCode?, countryCode, zip, phone?, label?
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) {
      return addCorsIfAdminOrigin(
        request,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    const { id: userId } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const address1 =
      typeof body.address1 === "string" ? body.address1.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const zip = typeof body.zip === "string" ? body.zip.trim() : "";
    const countryCode =
      typeof body.countryCode === "string"
        ? body.countryCode.trim().toUpperCase().slice(0, 2)
        : "";

    if (!address1 || !city || !zip || !countryCode) {
      return addCorsIfAdminOrigin(
        request,
        NextResponse.json(
          { error: "address1, city, zip, and countryCode are required" },
          { status: 400 },
        ),
      );
    }

    const existingAddresses = await db
      .select({ id: addressesTable.id })
      .from(addressesTable)
      .where(eq(addressesTable.userId, userId));

    const isDefault = existingAddresses.length === 0;
    const id = createId();
    const now = new Date();

    await db.insert(addressesTable).values({
      id,
      userId,
      address1,
      address2:
        typeof body.address2 === "string" ? body.address2.trim() || null : null,
      city,
      stateCode:
        typeof body.stateCode === "string"
          ? body.stateCode.trim() || null
          : null,
      countryCode,
      zip,
      phone: typeof body.phone === "string" ? body.phone.trim() || null : null,
      label: typeof body.label === "string" ? body.label.trim() || null : null,
      isDefault,
      createdAt: now,
      updatedAt: now,
    });

    return addCorsIfAdminOrigin(
      request,
      NextResponse.json({
        id,
        address1,
        city,
        stateCode:
          typeof body.stateCode === "string"
            ? body.stateCode.trim() || null
            : null,
        countryCode,
        zip,
        isDefault,
      }),
    );
  } catch (err) {
    console.error("Admin customer address create error:", err);
    return addCorsIfAdminOrigin(
      request,
      NextResponse.json({ error: "Failed to create address" }, { status: 500 }),
    );
  }
}
