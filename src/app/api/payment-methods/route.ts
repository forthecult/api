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
        displayOrder: paymentMethodSettingTable.displayOrder,
        enabled: paymentMethodSettingTable.enabled,
        enabledNetworks: paymentMethodSettingTable.enabledNetworks,
        label: paymentMethodSettingTable.label,
        methodKey: paymentMethodSettingTable.methodKey,
      })
      .from(paymentMethodSettingTable)
      .orderBy(paymentMethodSettingTable.displayOrder);

    const byKey = new Map(
      rows.map((r) => [
        r.methodKey,
        {
          displayOrder: r.displayOrder,
          enabled: r.enabled,
          enabledNetworks: Array.isArray(r.enabledNetworks)
            ? r.enabledNetworks
            : null,
          label: r.label,
          methodKey: r.methodKey,
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
          displayOrder: existing.displayOrder,
          enabled: existing.enabled,
          enabledNetworks: existing.enabledNetworks,
          label: existing.label,
          methodKey: existing.methodKey,
        });
      } else {
        toInsert.push(d);
        list.push({
          displayOrder: d.displayOrder,
          enabled: true,
          label: d.label,
          methodKey: d.methodKey,
        });
      }
    }
    list.sort((a, b) => a.displayOrder - b.displayOrder);

    if (toInsert.length > 0) {
      for (const d of toInsert) {
        await db.insert(paymentMethodSettingTable).values({
          createdAt: now,
          displayOrder: d.displayOrder,
          enabled: true,
          label: d.label,
          methodKey: d.methodKey,
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
