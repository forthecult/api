import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { productReviewsTable } from "~/db/schema";
import { getReviewDisplayName } from "~/lib/reviews";

const HOMEPAGE_LIMIT = 20;

/**
 * GET /api/reviews
 * Public. Returns visible reviews for homepage testimonials.
 * Query: limit (default 20, max 50), includeProductName (boolean).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          url.searchParams.get("limit") ?? String(HOMEPAGE_LIMIT),
          10,
        ) || HOMEPAGE_LIMIT,
      ),
    );
    const includeProductName =
      url.searchParams.get("includeProductName") === "true";

    const rows = await db.query.productReviewsTable.findMany({
      columns: {
        author: true,
        comment: true,
        customerName: true,
        id: true,
        rating: true,
        showName: true,
        ...(includeProductName && { productName: true }),
      },
      limit,
      orderBy: [desc(productReviewsTable.createdAt)],
      where: eq(productReviewsTable.visible, true),
    });

    const items = rows.map((r) => ({
      comment: r.comment,
      displayName: getReviewDisplayName({
        author: r.author ?? undefined,
        customerName: r.customerName,
        id: r.id,
        showName: r.showName,
      }),
      id: r.id,
      rating: r.rating,
      ...(includeProductName && {
        productName: (r as { productName?: null | string }).productName ?? null,
      }),
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Public reviews GET error:", err);
    return NextResponse.json(
      { error: "Failed to load reviews" },
      { status: 500 },
    );
  }
}
