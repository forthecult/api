import "server-only";
import { and, eq, isNull, lte, sql } from "drizzle-orm";

import { db } from "~/db";
import { shoppingCartSnapshotTable } from "~/db/schema";
import { ABANDON_CART_IDLE_SYNC_HOURS } from "~/lib/email/abandon-cart-schedule";
import { userWantsMarketingEmail } from "~/lib/email/consent";
import {
  enrollAbandonCartMarketingSeries,
  hasActiveEmailFunnelEnrollment,
} from "~/lib/email/funnel-enrollment";
import { getEmailFunnelCouponExperimentVariant } from "~/lib/email/posthog-email-experiments";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Enrolls signed-in shoppers into the 3-step abandon series when their server cart
 * snapshot has been idle long enough and they still allow marketing email.
 */
export async function processCartAbandonmentEnrollments(): Promise<{
  enrolled: number;
}> {
  const cutoff = new Date(Date.now() - ABANDON_CART_IDLE_SYNC_HOURS * HOUR_MS);

  const candidates = await db
    .select({
      email: shoppingCartSnapshotTable.email,
      id: shoppingCartSnapshotTable.id,
      itemsJson: shoppingCartSnapshotTable.itemsJson,
      userId: shoppingCartSnapshotTable.userId,
    })
    .from(shoppingCartSnapshotTable)
    .where(
      and(
        lte(shoppingCartSnapshotTable.lastSyncedAt, cutoff),
        isNull(shoppingCartSnapshotTable.purchaseCompletedAt),
        isNull(shoppingCartSnapshotTable.abandonEnrolledAt),
        sql`jsonb_array_length(${shoppingCartSnapshotTable.itemsJson}) > 0`,
      ),
    )
    .limit(80);

  let enrolled = 0;
  for (const row of candidates) {
    if (!(await userWantsMarketingEmail(row.userId))) continue;

    const emailNorm = row.email.trim().toLowerCase();
    if (await hasActiveEmailFunnelEnrollment(emailNorm, "abandon_cart_3")) {
      await db
        .update(shoppingCartSnapshotTable)
        .set({
          abandonEnrolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shoppingCartSnapshotTable.id, row.id));
      continue;
    }

    const distinct = row.userId.trim();
    const variant = await getEmailFunnelCouponExperimentVariant(distinct, {
      email: row.email.trim(),
      userId: row.userId,
    });
    const cartProductIds = productIdsFromItemsJson(row.itemsJson);

    try {
      await enrollAbandonCartMarketingSeries({
        context: { cartProductIds, snapshotId: row.id },
        email: row.email.trim(),
        experimentVariant: variant,
        userId: row.userId,
      });

      await db
        .update(shoppingCartSnapshotTable)
        .set({
          abandonEnrolledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shoppingCartSnapshotTable.id, row.id));

      enrolled += 1;
    } catch (err) {
      console.error(
        "[processCartAbandonmentEnrollments] enroll failed:",
        row.id,
        err,
      );
    }
  }

  return { enrolled };
}

function productIdsFromItemsJson(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const ids: string[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const pid = (row as { productId?: unknown }).productId;
    if (typeof pid === "string" && pid.trim()) ids.push(pid.trim());
  }
  return [...new Set(ids)];
}
