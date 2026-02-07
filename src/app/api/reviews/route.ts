import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "~/db";
import { productReviewsTable } from "~/db/schema";
import { getReviewDisplayName } from "~/lib/reviews";

const HOMEPAGE_LIMIT = 20;

/**
 * GET /api/reviews
 * Public. Returns visible reviews for homepage testimonials.
 * Query: limit (default 20, max 50).
 */
export async function GET(request: Request) {
  try {
    const limit = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          new URL(request.url).searchParams.get("limit") ??
            String(HOMEPAGE_LIMIT),
          10,
        ) || HOMEPAGE_LIMIT,
      ),
    );

    const rows = await db.query.productReviewsTable.findMany({
      columns: {
        id: true,
        comment: true,
        rating: true,
        customerName: true,
        author: true,
        showName: true,
      },
      where: eq(productReviewsTable.visible, true),
      orderBy: [desc(productReviewsTable.createdAt)],
      limit,
    });

    const items = rows.map((r) => ({
      id: r.id,
      comment: r.comment,
      rating: r.rating,
      displayName: getReviewDisplayName({
        id: r.id,
        customerName: r.customerName,
        showName: r.showName,
        author: r.author ?? undefined,
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
