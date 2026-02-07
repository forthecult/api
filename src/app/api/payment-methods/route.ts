import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { paymentMethodSettingTable } from "~/db/schema";
import {
  PAYMENT_METHOD_DEFAULTS,
  type PaymentMethodSetting,
} from "~/lib/payment-method-settings";

const now = new Date();

/**
 * GET /api/payment-methods
 * Public: returns which payment methods are enabled (for checkout and product pages).
 * If no rows exist, seeds defaults (all enabled) and returns them.
 */
export async function GET() {
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
    // Seed defaults (all enabled)
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
