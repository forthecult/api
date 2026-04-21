/**
 * POST /api/admin/membership/subscriptions/[subscriptionId]/cancel
 *
 * Cancels the membership offer `subscription_instance` row and the provider
 * subscription when applicable (Stripe / PayPal). See `adminCancelMembershipSubscription`.
 */

import { type NextRequest, NextResponse } from "next/server";

import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { adminCancelMembershipSubscription } from "~/lib/admin-cancel-membership-subscription";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  const authResult = await getAdminAuth(_request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const { subscriptionId } = await params;
  if (!subscriptionId?.trim()) {
    return NextResponse.json(
      { error: "subscriptionId required" },
      { status: 400 },
    );
  }

  const result = await adminCancelMembershipSubscription(subscriptionId.trim());
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ ok: true });
}
