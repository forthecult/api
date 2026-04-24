import { and, eq, inArray, or } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  productReviewsTable,
  productsTable,
} from "~/db/schema";
import { auth } from "~/lib/auth";
import { csrfFailureResponse, verifyCsrfOrigin } from "~/lib/csrf";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

/**
 * Logged-in customers: submit a product review (moderated; hidden until admin approves).
 * GTIN, MPN, and brand in the Google feed are read from the product at feed generation time.
 */
export async function POST(request: NextRequest) {
  if (!verifyCsrfOrigin(request.headers)) return csrfFailureResponse();
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(`review-submit:${ip}`, RATE_LIMITS.api);
  if (!rl.success) return rateLimitResponse(rl);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    customName?: null | string;
    location?: null | string;
    productSlug?: string;
    rating?: number;
    text?: string;
    title?: null | string;
    visibility?: "account" | "anonymous" | "custom";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawSlug = body.productSlug?.trim();
  if (!rawSlug) {
    return NextResponse.json(
      { error: "productSlug required" },
      { status: 400 },
    );
  }
  const text = body.text?.trim() ?? "";
  if (text.length < 4 || text.length > 8000) {
    return NextResponse.json(
      { error: "Review text must be 4–8000 characters" },
      { status: 400 },
    );
  }
  const rating = Math.min(5, Math.max(1, Math.floor(body.rating ?? 5)));
  const lastSegment = rawSlug
    .replace(/^\//, "")
    .split("?")[0]!
    .split("/")
    .filter(Boolean);
  const slug = lastSegment[lastSegment.length - 1] ?? rawSlug;
  const [product] = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      slug: productsTable.slug,
    })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.published, true),
        eq(productsTable.hidden, false),
        eq(productsTable.slug, slug),
      ),
    )
    .limit(1);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const [purchase] = await db
    .select({ id: orderItemsTable.id })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.userId, session.user.id),
        eq(orderItemsTable.productId, product.id),
        or(
          inArray(ordersTable.status, ["paid", "fulfilled"]),
          eq(ordersTable.paymentStatus, "paid"),
        ),
      ),
    )
    .limit(1);
  if (!purchase) {
    return NextResponse.json(
      { error: "You need a purchase of this product to leave a review" },
      { status: 403 },
    );
  }
  const visibility = body.visibility ?? "account";
  const customName = body.customName?.trim() ?? "";
  if (
    visibility === "custom" &&
    (customName.length < 1 || customName.length > 80)
  ) {
    return NextResponse.json(
      { error: "Custom public name must be 1–80 characters" },
      { status: 400 },
    );
  }
  if (visibility === "custom") {
    // Avoid odd control / injection characters; allow letters, numbers, space, simple punctuation
    for (const ch of customName) {
      const c = ch.codePointAt(0) ?? 0;
      if (c < 0x20) {
        return NextResponse.json(
          { error: "Custom public name contains invalid characters" },
          { status: 400 },
        );
      }
    }
  }
  const locationRaw = body.location?.trim() ?? "";
  if (locationRaw.length > 200) {
    return NextResponse.json(
      { error: "Location must be at most 200 characters" },
      { status: 400 },
    );
  }
  const accountName =
    session.user.name ||
    (session.user.email
      ? (session.user.email.split("@")[0] ?? "Customer")
      : "Customer");
  const now = new Date();
  const showName = visibility !== "anonymous";
  const author: null | string =
    visibility === "custom" && customName ? customName : null;
  await db.insert(productReviewsTable).values({
    author,
    comment: text,
    createdAt: now,
    customerName: accountName,
    id: `rv_${randomUUID()}`,
    location: locationRaw || null,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug ?? slug,
    rating,
    showName,
    title: body.title?.trim() || null,
    updatedAt: now,
    userId: session.user.id,
    visible: false,
  });
  return NextResponse.json({ ok: true });
}
