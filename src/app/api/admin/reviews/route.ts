import { desc, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { productReviewsTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import { getReviewDisplayName } from "~/lib/reviews";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const page = Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10),
    );
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get("limit") ??
            String(DEFAULT_PAGE_SIZE),
          10,
        ),
      ),
    );
    const offset = (page - 1) * limit;

    const [reviews, countResult] = await Promise.all([
      db.query.productReviewsTable.findMany({
        limit,
        offset,
        orderBy: [desc(productReviewsTable.createdAt)],
        with: {
          product: {
            columns: { id: true, imageUrl: true, name: true },
          },
          user: {
            columns: { email: true, id: true, name: true },
          },
        },
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(productReviewsTable),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const items = reviews.map((r) => {
      const author = (r as { author?: null | string }).author ?? null;
      const title = (r as { title?: null | string }).title ?? null;
      const location = (r as { location?: null | string }).location ?? null;
      const productName =
        (r as { productName?: null | string }).productName ?? null;
      const productSlug =
        (r as { productSlug?: null | string }).productSlug ?? null;
      const createdAt = r.createdAt;
      return {
        author,
        comment: r.comment,
        createdAt:
          createdAt instanceof Date
            ? createdAt.toISOString()
            : String(createdAt ?? ""),
        customerEmail: r.user?.email ?? null,
        customerName: r.customerName,
        displayName: getReviewDisplayName({
          author,
          customerName: r.customerName,
          id: r.id,
          showName: r.showName,
        }),
        id: r.id,
        location,
        productId: r.productId,
        productImageUrl: r.product?.imageUrl ?? null,
        // Use linked product name, fall back to stored snapshot, then null
        productName: r.product?.name ?? productName,
        productSlug,
        rating: r.rating,
        showName: r.showName,
        title,
        userId: r.userId ?? null,
        visible: r.visible,
      };
    });

    return NextResponse.json({
      items,
      limit,
      page,
      totalCount,
      totalPages,
    });
  } catch (err) {
    console.error("Admin reviews list error:", err);
    const message = err instanceof Error ? err.message : "";
    const isColumnError =
      message && /column.*does not exist|Unknown column/i.test(message);
    const hint = isColumnError
      ? " Run: bun run db:push (or psql $DATABASE_URL -f scripts/migrate-reviews-add-display-columns.sql) to add missing product_review columns."
      : "";
    return NextResponse.json(
      {
        error: "Failed to load reviews",
        ...(isColumnError ? { hint: hint.trim() } : {}),
        ...(process.env.NODE_ENV === "development" && message
          ? { detail: message + (hint ? ` ${hint}` : "") }
          : {}),
      },
      { status: 500 },
    );
  }
}
