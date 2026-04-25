import "server-only";

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "~/db";
import { ordersTable, userTable } from "~/db/schema";

/**
 * Idempotent stub for X / Reddit / YouTube server-side conversion APIs (CAPI).
 * Honors `user.ad_platform_conversion_forwarding` when the order has a userId.
 * Never throws to callers — failures are logged only.
 */
export async function runAdServerConversionsForOrder(
  orderId: string,
): Promise<void> {
  try {
    const [order] = await db
      .select({
        adServerConversionSentAt: ordersTable.adServerConversionSentAt,
        attributionSnapshotJson: ordersTable.attributionSnapshotJson,
        email: ordersTable.email,
        id: ordersTable.id,
        totalCents: ordersTable.totalCents,
        userId: ordersTable.userId,
      })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    if (!order) return;
    if (order.adServerConversionSentAt) return;

    let forward = true;
    if (order.userId) {
      const [u] = await db
        .select({
          adPlatformConversionForwarding:
            userTable.adPlatformConversionForwarding,
        })
        .from(userTable)
        .where(eq(userTable.id, order.userId))
        .limit(1);
      if (u?.adPlatformConversionForwarding === false) {
        forward = false;
      }
    }

    const emailNorm = order.email?.trim().toLowerCase() ?? "";
    const emailHash =
      emailNorm.length > 0
        ? createHash("sha256").update(emailNorm).digest("hex")
        : null;

    let attributionKeyCount = 0;
    if (order.attributionSnapshotJson?.trim()) {
      try {
        const o = JSON.parse(order.attributionSnapshotJson) as unknown;
        if (o && typeof o === "object" && !Array.isArray(o)) {
          attributionKeyCount = Object.keys(
            o as Record<string, unknown>,
          ).length;
        }
      } catch {
        // ignore malformed snapshot
      }
    }

    if (forward) {
      // Stub: replace with real platform HTTP clients + env credentials.
      console.info("[ad-server-conversions] stub dispatch", {
        attributionKeyCount,
        emailHashPrefix: emailHash?.slice(0, 12),
        orderId: order.id,
        valueUsd: order.totalCents / 100,
      });
    } else {
      console.info("[ad-server-conversions] skipped (user opt-out)", {
        orderId: order.id,
      });
    }

    await db
      .update(ordersTable)
      .set({
        adServerConversionSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));
  } catch (e) {
    console.error("[ad-server-conversions] error", orderId, e);
  }
}
