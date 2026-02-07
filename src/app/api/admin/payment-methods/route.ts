import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { paymentMethodSettingTable } from "~/db/schema";
import { getAdminAuth } from "~/lib/admin-api-auth";
import {
  PAYMENT_METHOD_DEFAULTS,
  type PaymentMethodSetting,
} from "~/lib/payment-method-settings";

const now = new Date();

/**
 * GET /api/admin/payment-methods
 * Admin: list all payment methods with enabled flag (for admin UI).
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      methodKey: paymentMethodSettingTable.methodKey,
      label: paymentMethodSettingTable.label,
      enabled: paymentMethodSettingTable.enabled,
      displayOrder: paymentMethodSettingTable.displayOrder,
    })
    .from(paymentMethodSettingTable)
    .orderBy(paymentMethodSettingTable.displayOrder);

  if (rows.length === 0) {
    // Seed defaults
    for (const d of PAYMENT_METHOD_DEFAULTS) {
      await db.insert(paymentMethodSettingTable).values({
        methodKey: d.methodKey,
        label: d.label,
        enabled: true,
        displayOrder: d.displayOrder,
        createdAt: now,
        updatedAt: now,
      });
    }
    const list: PaymentMethodSetting[] = PAYMENT_METHOD_DEFAULTS.map(
      (d) => ({
        methodKey: d.methodKey,
        label: d.label,
        enabled: true,
        displayOrder: d.displayOrder,
      }),
    );
    return NextResponse.json({ data: list });
  }

  const list: PaymentMethodSetting[] = rows.map((r) => ({
    methodKey: r.methodKey,
    label: r.label,
    enabled: r.enabled,
    displayOrder: r.displayOrder,
  }));

  return NextResponse.json({ data: list });
}

/**
 * PATCH /api/admin/payment-methods
 * Admin: enable or disable a payment method.
 * Body: { methodKey: string, enabled: boolean }
 */
export async function PATCH(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { methodKey?: string; enabled?: boolean };
  try {
    body = (await request.json()) as { methodKey?: string; enabled?: boolean };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const methodKey = body.methodKey?.trim();
  const enabled = body.enabled;

  if (!methodKey) {
    return NextResponse.json(
      { error: "methodKey is required" },
      { status: 400 },
    );
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const exists = await db
    .select({ methodKey: paymentMethodSettingTable.methodKey })
    .from(paymentMethodSettingTable)
    .where(eq(paymentMethodSettingTable.methodKey, methodKey))
    .limit(1);

  if (exists.length > 0) {
    await db
      .update(paymentMethodSettingTable)
      .set({ enabled, updatedAt: now })
      .where(eq(paymentMethodSettingTable.methodKey, methodKey));
  } else {
    const def = PAYMENT_METHOD_DEFAULTS.find((d) => d.methodKey === methodKey);
    if (!def) {
      return NextResponse.json(
        { error: `Unknown methodKey: ${methodKey}` },
        { status: 400 },
      );
    }
    await db.insert(paymentMethodSettingTable).values({
      methodKey: def.methodKey,
      label: def.label,
      enabled,
      displayOrder: def.displayOrder,
      createdAt: now,
      updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true });
}
