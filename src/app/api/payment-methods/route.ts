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
 * On DB error, returns default list so the storefront still loads.
 */
export async function GET() {
  try {
    const rows = await db
    .select({
      methodKey: paymentMethodSettingTable.methodKey,
      label: paymentMethodSettingTable.label,
      enabled: paymentMethodSettingTable.enabled,
      enabledNetworks: paymentMethodSettingTable.enabledNetworks,
      displayOrder: paymentMethodSettingTable.displayOrder,
    })
    .from(paymentMethodSettingTable)
    .orderBy(paymentMethodSettingTable.displayOrder);

  const byKey = new Map(
    rows.map((r) => [
      r.methodKey,
      {
        methodKey: r.methodKey,
        label: r.label,
        enabled: r.enabled,
        enabledNetworks: Array.isArray(r.enabledNetworks) ? r.enabledNetworks : null,
        displayOrder: r.displayOrder,
      },
    ]),
  );

  // Merge PAYMENT_METHOD_DEFAULTS so new methods appear (default enabled); seed DB if missing
  const list: PaymentMethodSetting[] = [];
  const toInsert: (typeof PAYMENT_METHOD_DEFAULTS)[number][] = [];
  for (const d of PAYMENT_METHOD_DEFAULTS) {
    const existing = byKey.get(d.methodKey);
    if (existing) {
      list.push({
        methodKey: existing.methodKey,
        label: existing.label,
        enabled: existing.enabled,
        enabledNetworks: existing.enabledNetworks,
        displayOrder: existing.displayOrder,
      });
    } else {
      toInsert.push(d);
      list.push({
        methodKey: d.methodKey,
        label: d.label,
        enabled: true,
        displayOrder: d.displayOrder,
      });
    }
  }
  list.sort((a, b) => a.displayOrder - b.displayOrder);

  if (toInsert.length > 0) {
    for (const d of toInsert) {
      await db.insert(paymentMethodSettingTable).values({
        methodKey: d.methodKey,
        label: d.label,
        enabled: true,
        displayOrder: d.displayOrder,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ data: list });
  } catch (err) {
    console.error("Payment methods GET error:", err);
    // Return empty list on DB error so the frontend can distinguish "no data"
    // from "all enabled". The checkout UI treats null visibility (empty data) as
    // a loading/fallback state with sensible defaults.
    return NextResponse.json({ data: [] });
  }
}
