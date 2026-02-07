import { createId } from "@paralleldrive/cuid2";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { boxoOrderPaymentTable } from "~/db/schema";
import { verifyBoxoAuthorization } from "~/lib/boxo-auth";

/**
 * POST /api/boxo/payments/create-order
 * Called by Boxo to create an order payment. We create a record and return order_payment_id.
 * Headers: Authorization (Token base64(client_id:secret)), X-User-ID (host user reference)
 * Body: { app_id, order: { currency, amount, miniapp_order_id?, hostapp_user_id?, ... } }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!verifyBoxoAuthorization(authHeader)) {
    return NextResponse.json(
      { error_code: "INVALID_CREDENTIALS" },
      { status: 401 },
    );
  }

  const userId = request.headers.get("X-User-ID")?.trim();
  if (!userId) {
    return NextResponse.json(
      { error_code: "MISSING_USER_REFERENCE" },
      { status: 200 },
    );
  }

  let body: {
    app_id?: string;
    order?: {
      currency?: string;
      amount?: string | number;
      miniapp_order_id?: string;
      hostapp_user_id?: string;
      [key: string]: unknown;
    };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error_code: "INVALID_ORDER_DATA" },
      { status: 200 },
    );
  }

  const appId = body.app_id?.trim();
  const order = body.order;
  if (!appId || !order) {
    return NextResponse.json(
      { error_code: "INVALID_ORDER_DATA" },
      { status: 200 },
    );
  }

  const amount = String(
    order.amount != null ? Number(order.amount) : 0,
  );
  const currency = order.currency?.trim() ?? "USD";
  const miniappOrderId = order.miniapp_order_id?.trim();
  const clientId =
    process.env.BOXO_CLIENT_ID ?? process.env.NEXT_PUBLIC_BOXO_CLIENT_ID ?? "";

  const id = createId();
  const now = new Date();

  await db.insert(boxoOrderPaymentTable).values({
    id,
    appId,
    clientId,
    userId,
    miniappOrderId: miniappOrderId ?? null,
    amount,
    currency,
    status: "in_process",
    orderPayload: order as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({
    order_payment_id: id,
  });
}
