import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { wishlistTable } from "~/db/schema";
import { auth } from "~/lib/auth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function isPostgresError(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err;
}

/**
 * GET /api/wishlist
 * Returns user's wishlist items with pagination.
 * Query params: page (default 1), limit (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    let session;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch (sessionErr) {
      console.error("Wishlist get-session error:", sessionErr);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      );
    }
    if (!session?.user?.id) {
      return NextResponse.json({
        items: [],
        pagination: { page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 },
      });
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") ?? "1", 10) || 1,
    );
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(
        1,
        parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
          DEFAULT_LIMIT,
      ),
    );
    const offset = (page - 1) * limit;

    const [items, countResult] = await Promise.all([
      db.query.wishlistTable.findMany({
        where: eq(wishlistTable.userId, session.user.id),
        with: {
          product: {
            columns: {
              id: true,
              name: true,
              slug: true,
              imageUrl: true,
              priceCents: true,
              hasVariants: true,
            },
          },
        },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(wishlistTable)
        .where(eq(wishlistTable.userId, session.user.id)),
    ]);

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const list = items
      .filter((i) => i.product)
      .map((i) => ({
        productId: i.productId,
        createdAt: i.createdAt.toISOString(),
        product: {
          id: i.product!.id,
          slug: i.product!.slug ?? undefined,
          name: i.product!.name,
          imageUrl: i.product!.imageUrl,
          priceCents: i.product!.priceCents,
          hasVariants: i.product!.hasVariants ?? false,
        },
      }));

    return NextResponse.json({
      items: list,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    console.error("Wishlist get error:", err);
    if (isPostgresError(err) && err.code === "42P01") {
      return NextResponse.json(
        { error: "Database tables missing. Run: bun run db:push" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load wishlist" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let session;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch (sessionErr) {
      console.error("Wishlist add get-session error:", sessionErr);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      );
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { productId?: string };
    const productId =
      typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    const now = new Date();
    await db
      .insert(wishlistTable)
      .values({
        userId: session.user.id,
        productId,
        createdAt: now,
      })
      .onConflictDoNothing({
        target: [wishlistTable.userId, wishlistTable.productId],
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Wishlist add error:", err);
    if (isPostgresError(err)) {
      if (err.code === "42P01") {
        return NextResponse.json(
          { error: "Database tables missing. Run: bun run db:push" },
          { status: 503 },
        );
      }
      // 23503 = foreign_key_violation (e.g. productId doesn't exist)
      if (err.code === "23503") {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(
      { error: "Failed to add to wishlist" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let session;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch (sessionErr) {
      console.error("Wishlist remove get-session error:", sessionErr);
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503 },
      );
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productId =
      request.nextUrl.searchParams.get("productId")?.trim() ?? "";
    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 },
      );
    }

    await db
      .delete(wishlistTable)
      .where(
        and(
          eq(wishlistTable.userId, session.user.id),
          eq(wishlistTable.productId, productId),
        ),
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Wishlist remove error:", err);
    if (isPostgresError(err) && err.code === "42P01") {
      return NextResponse.json(
        { error: "Database tables missing. Run: bun run db:push" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to remove from wishlist" },
      { status: 500 },
    );
  }
}
