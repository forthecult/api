import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "~/db";
import { shoppingCartSnapshotTable } from "~/db/schema";

/**
 * Marks open cart snapshots as purchased so abandon-cart enrollment skips them.
 */
export async function markShoppingCartSnapshotsPurchased(params: {
  email: string;
  userId: null | string;
}): Promise<void> {
  const emailNorm = params.email.trim().toLowerCase();
  if (!emailNorm) return;
  const now = new Date();

  const emailMatch = eq(
    sql<string>`lower(trim(${shoppingCartSnapshotTable.email}))`,
    emailNorm,
  );

  const whereExpr = params.userId?.trim()
    ? and(
        isNull(shoppingCartSnapshotTable.purchaseCompletedAt),
        or(eq(shoppingCartSnapshotTable.userId, params.userId), emailMatch),
      )
    : and(isNull(shoppingCartSnapshotTable.purchaseCompletedAt), emailMatch);

  await db
    .update(shoppingCartSnapshotTable)
    .set({
      lastSyncedAt: now,
      purchaseCompletedAt: now,
      updatedAt: now,
    })
    .where(whereExpr);
}
