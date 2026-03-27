/**
 * GET /api/subscriptions/catalog
 *
 * Public list of published subscription offers and their billing plans.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import {
  subscriptionOfferTable,
  subscriptionPlanTable,
} from "~/db/schema";

export async function GET() {
  try {
    const offers = await db
      .select()
      .from(subscriptionOfferTable)
      .where(eq(subscriptionOfferTable.published, true))
      .orderBy(asc(subscriptionOfferTable.name));

    const offerIds = offers.map((o) => o.id);
    const plans =
      offerIds.length === 0
        ? []
        : await db
            .select()
            .from(subscriptionPlanTable)
            .where(
              and(
                eq(subscriptionPlanTable.published, true),
                inArray(subscriptionPlanTable.offerId, offerIds),
              ),
            )
            .orderBy(asc(subscriptionPlanTable.sortOrder));

    const planByOffer = new Map<string, typeof plans>();
    for (const p of plans) {
      const list = planByOffer.get(p.offerId) ?? [];
      list.push(p);
      planByOffer.set(p.offerId, list);
    }

    return NextResponse.json({
      offers: offers.map((o) => ({
        description: o.description,
        id: o.id,
        metadata: o.metadata,
        name: o.name,
        plans: (planByOffer.get(o.id) ?? []).map((p) => ({
          currency: p.currency,
          displayName: p.displayName,
          id: p.id,
          intervalCount: p.intervalCount,
          intervalUnit: p.intervalUnit,
          payCryptoManual: p.payCryptoManual,
          payPaypal: p.payPaypal,
          payStripe: p.payStripe,
          priceCents: p.priceCents,
          cryptoProductId: p.cryptoProductId,
        })),
        productId: o.productId,
        slug: o.slug,
      })),
    });
  } catch (err) {
    console.error("[subscriptions/catalog]", err);
    return NextResponse.json(
      { error: "Failed to load subscription catalog" },
      { status: 500 },
    );
  }
}
