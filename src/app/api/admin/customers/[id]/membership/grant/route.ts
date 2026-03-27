/**
 * POST /api/admin/customers/[id]/membership/grant
 * Grant admin membership to a customer for 30 days or 1 year. Upserts one grant per user.
 * DELETE: remove admin-granted membership.
 *
 * This is admin-comped access (`admin_membership_grant`), not a Stripe/PayPal subscription row.
 * For paid recurring membership, see `subscription_instance` and
 * `POST /api/admin/membership/subscriptions/[subscriptionId]/cancel`.
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { adminMembershipGrantTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const DURATION_MS: Record<string, number> = {
  "30d": 30 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const { id: userId } = await params;
  let body: { duration?: string; tier?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const duration = body.duration === "1y" ? "1y" : "30d";
  const tier =
    typeof body.tier === "number" && body.tier >= 1 && body.tier <= 3
      ? body.tier
      : 3;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (DURATION_MS[duration] ?? DURATION_MS["30d"]));

  await db
    .insert(adminMembershipGrantTable)
    .values({
      userId,
      tier,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: adminMembershipGrantTable.userId,
      set: {
        tier,
        expiresAt,
        updatedAt: now,
      },
    });

  return NextResponse.json({
    expiresAt: expiresAt.toISOString(),
    tier,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await getAdminAuth(_request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const { id: userId } = await params;

  await db
    .delete(adminMembershipGrantTable)
    .where(eq(adminMembershipGrantTable.userId, userId));

  return NextResponse.json({ removed: true });
}
