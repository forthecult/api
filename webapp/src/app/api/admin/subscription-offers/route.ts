/**
 * GET/POST /api/admin/subscription-offers
 * Manage reusable subscription offers and billing plans (Stripe / PayPal / manual crypto).
 */

import { createId } from "@paralleldrive/cuid2";
import { desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { subscriptionOfferTable, subscriptionPlanTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const offers = await db
      .select()
      .from(subscriptionOfferTable)
      .orderBy(desc(subscriptionOfferTable.updatedAt));

    const plans = await db
      .select()
      .from(subscriptionPlanTable)
      .orderBy(subscriptionPlanTable.sortOrder);

    const byOffer = new Map<string, typeof plans>();
    for (const p of plans) {
      const list = byOffer.get(p.offerId) ?? [];
      list.push(p);
      byOffer.set(p.offerId, list);
    }

    return NextResponse.json({
      offers: offers.map((o) => ({
        ...o,
        plans: byOffer.get(o.id) ?? [],
      })),
    });
  } catch (err) {
    console.error("[admin/subscription-offers GET]", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const body = (await request.json()) as {
      offer: {
        description?: string;
        name: string;
        productId?: string;
        published?: boolean;
        slug: string;
      };
      plans?: {
        cryptoProductId?: string;
        currency?: string;
        displayName?: string;
        intervalCount?: number;
        intervalUnit: string;
        payCryptoManual?: boolean;
        paypalPlanId?: string;
        payPaypal?: boolean;
        payStripe?: boolean;
        priceCents: number;
        published?: boolean;
        sortOrder?: number;
        stripePriceId?: string;
      }[];
    };

    const slug = body.offer?.slug?.trim();
    const name = body.offer?.name?.trim();
    if (!slug || !name) {
      return NextResponse.json(
        { error: "offer.slug and offer.name required" },
        { status: 400 },
      );
    }

    const [dup] = await db
      .select({ id: subscriptionOfferTable.id })
      .from(subscriptionOfferTable)
      .where(eq(subscriptionOfferTable.slug, slug))
      .limit(1);
    if (dup) {
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 },
      );
    }

    const offerId = createId();
    await db.insert(subscriptionOfferTable).values({
      description: body.offer.description ?? null,
      id: offerId,
      name,
      productId: body.offer.productId ?? null,
      published: body.offer.published ?? true,
      slug,
    });

    const planRows = [];
    for (const p of body.plans ?? []) {
      if (!p.intervalUnit || typeof p.priceCents !== "number") continue;
      planRows.push({
        cryptoProductId: p.cryptoProductId ?? null,
        currency: p.currency ?? "USD",
        displayName: p.displayName ?? null,
        id: createId(),
        intervalCount: p.intervalCount ?? 1,
        intervalUnit: p.intervalUnit,
        offerId,
        payCryptoManual: p.payCryptoManual ?? false,
        paypalPlanId: p.paypalPlanId ?? null,
        payPaypal: p.payPaypal ?? false,
        payStripe: p.payStripe ?? false,
        priceCents: p.priceCents,
        published: p.published ?? true,
        sortOrder: p.sortOrder ?? 0,
        stripePriceId: p.stripePriceId ?? null,
      });
    }

    if (planRows.length > 0) {
      await db.insert(subscriptionPlanTable).values(planRows);
    }

    return NextResponse.json({ id: offerId, slug }, { status: 201 });
  } catch (err) {
    console.error("[admin/subscription-offers POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
