/**
 * POST /api/cart/snapshot
 *
 * Persists a signed-in shopper’s cart for abandon-flow detection (see cron
 * `cart-abandon-enroll`). Body is capped; rate-limited per IP.
 */

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { shoppingCartSnapshotTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  rateLimitResponse,
} from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const BODY_LIMIT = 64 * 1024;
const MAX_ITEMS = 60;

interface CartSnapshotItem {
  id?: unknown;
  name?: unknown;
  price?: unknown;
  productId?: unknown;
  productVariantId?: unknown;
  quantity?: unknown;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await checkRateLimit(
    `cart-snapshot:${ip}`,
    RATE_LIMITS.cartSnapshot,
  );
  if (!rl.success) return rateLimitResponse(rl);

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id || !session.user.email?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawText = await request.text();
  if (rawText.length > BODY_LIMIT) {
    return NextResponse.json({ error: "Body too large" }, { status: 400 });
  }

  let body: { items?: unknown; subtotalCents?: unknown };
  try {
    body = JSON.parse(rawText) as { items?: unknown; subtotalCents?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = sanitizeItems(body.items);
  const subtotalCents =
    typeof body.subtotalCents === "number" &&
    Number.isFinite(body.subtotalCents) &&
    body.subtotalCents >= 0
      ? Math.min(2_000_000_00, Math.floor(body.subtotalCents))
      : 0;

  const userId = session.user.id;
  const email = session.user.email.trim();
  const now = new Date();

  const [existing] = await db
    .select({ id: shoppingCartSnapshotTable.id })
    .from(shoppingCartSnapshotTable)
    .where(eq(shoppingCartSnapshotTable.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(shoppingCartSnapshotTable)
      .set({
        email,
        itemsJson: items,
        lastSyncedAt: now,
        subtotalCents,
        updatedAt: now,
      })
      .where(eq(shoppingCartSnapshotTable.id, existing.id));
  } else {
    await db.insert(shoppingCartSnapshotTable).values({
      createdAt: now,
      email,
      id: createId(),
      itemsJson: items,
      lastSyncedAt: now,
      subtotalCents,
      updatedAt: now,
      userId,
    });
  }

  return NextResponse.json({ ok: true });
}

function sanitizeItems(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  const out: unknown[] = [];
  for (const row of raw.slice(0, MAX_ITEMS)) {
    if (!row || typeof row !== "object") continue;
    const o = row as CartSnapshotItem;
    const id = typeof o.id === "string" ? o.id : null;
    const name = typeof o.name === "string" ? o.name.slice(0, 400) : "";
    const price =
      typeof o.price === "number" && Number.isFinite(o.price) ? o.price : 0;
    const quantity =
      typeof o.quantity === "number" &&
      Number.isFinite(o.quantity) &&
      o.quantity > 0
        ? Math.min(999, Math.floor(o.quantity))
        : 1;
    const productId = typeof o.productId === "string" ? o.productId : null;
    const productVariantId =
      typeof o.productVariantId === "string" ? o.productVariantId : null;
    if (!id) continue;
    out.push({
      id,
      name,
      price,
      productId,
      productVariantId,
      quantity,
    });
  }
  return out;
}
