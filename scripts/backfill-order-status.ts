/**
 * Backfill paymentStatus and fulfillmentStatus for existing orders that only have legacy status.
 * Run once: bun run scripts/backfill-order-status.ts
 *
 * - fulfillmentStatus: "fulfilled" only when status === "fulfilled", else "unfulfilled"
 * - paymentStatus: from legacy status (refunded -> refunded, paid/fulfilled -> paid, cancelled -> cancelled, else pending)
 */

import "dotenv/config";

import { eq, isNull, or } from "drizzle-orm";

import { db } from "../src/db";
import { ordersTable } from "../src/db/schema";

function paymentFromLegacy(status: string): string {
  if (status === "refunded") return "refunded";
  if (status === "paid" || status === "fulfilled") return "paid";
  if (status === "cancelled") return "cancelled";
  return "pending";
}

function fulfillmentFromLegacy(status: string): string {
  return status === "fulfilled" ? "fulfilled" : "unfulfilled";
}

async function backfill() {
  const orders = await db
    .select({ id: ordersTable.id, status: ordersTable.status })
    .from(ordersTable)
    .where(
      or(
        isNull(ordersTable.paymentStatus),
        isNull(ordersTable.fulfillmentStatus),
      ),
    );

  if (orders.length === 0) {
    console.log("No orders need backfill.");
    return;
  }

  console.log(
    `Backfilling paymentStatus and fulfillmentStatus for ${orders.length} order(s)...`,
  );
  let updated = 0;
  for (const o of orders) {
    await db
      .update(ordersTable)
      .set({
        paymentStatus: paymentFromLegacy(o.status),
        fulfillmentStatus: fulfillmentFromLegacy(o.status),
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, o.id));
    updated++;
  }
  console.log(`Updated ${updated} order(s).`);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
