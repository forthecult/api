import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoOrderPaymentTable } from "~/db/schema";
import { verifyBoxoAuthorization } from "~/lib/boxo-auth";

/**
 * POST /api/boxo/payments/status
 * Called by Boxo to get order payment status.
 * Body: { app_id, client_id, order_payment_id }
 * Returns: { app_id, client_id, order_payment_id, payment_status [, payment_fail_reason ] }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!verifyBoxoAuthorization(authHeader)) {
    return NextResponse.json(
      { error_code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  let body: {
    app_id?: string;
    client_id?: string;
    order_payment_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error_code: "ORDER_NOT_FOUND" },
      { status: 200 },
    );
  }

  const orderPaymentId = body.order_payment_id?.trim();
  if (!orderPaymentId) {
    return NextResponse.json(
      { error_code: "ORDER_NOT_FOUND" },
      { status: 200 },
    );
  }

  const [row] = await db
    .select()
    .from(boxoOrderPaymentTable)
    .where(eq(boxoOrderPaymentTable.id, orderPaymentId))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error_code: "ORDER_NOT_FOUND" },
      { status: 200 },
    );
  }

  return NextResponse.json({
    app_id: row.appId,
    client_id: row.clientId,
    order_payment_id: row.id,
    payment_status: row.status,
    ...(row.paymentFailReason && {
      payment_fail_reason: row.paymentFailReason,
    }),
  });
}
