/**
 * eSIM fulfillment — provisions eSIM after payment confirmation.
 *
 * Called from every payment confirmation path (Stripe webhook, Solana Pay,
 * ETH Pay, BTCPay, TON Pay) following the same pattern as Printful/Printify.
 * After provisioning, sends an activation email to the customer; for guests,
 * includes a signup link so they can create an account.
 */

import { eq } from "drizzle-orm";

import { db } from "~/db";
import { esimOrdersTable, ordersTable } from "~/db/schema";
import {
  getMyEsims,
  purchaseEsimDataVoiceSms,
  purchaseEsimPackage,
} from "~/lib/esim-api";
import { sendEsimActivationEmail } from "~/lib/send-esim-activation-email";

export interface EsimFulfillmentResult {
  error?: string;
  esimOrderId?: string;
  success: boolean;
}

/**
 * Provision eSIMs from the reseller API for all pending eSIM items
 * attached to the given order. Called after payment is confirmed.
 */
export async function fulfillEsimOrder(
  orderId: string,
): Promise<EsimFulfillmentResult> {
  try {
    const [order] = await db
      .select({ email: ordersTable.email, userId: ordersTable.userId })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    // Find all pending eSIM orders linked to this order
    const esimOrders = await db
      .select()
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.orderId, orderId));

    if (esimOrders.length === 0) {
      return { success: true }; // Nothing to fulfill
    }

    const activationItems: {
      activationLink: null | string;
      packageName: string;
    }[] = [];

    for (const esimOrder of esimOrders) {
      // Skip if already fulfilled
      if (esimOrder.status === "active" || esimOrder.status === "processing") {
        continue;
      }

      try {
        // Purchase from eSIM Card API
        let purchaseResult;
        if (esimOrder.packageType === "DATA-VOICE-SMS") {
          purchaseResult = await purchaseEsimDataVoiceSms(esimOrder.packageId);
        } else {
          purchaseResult = await purchaseEsimPackage(esimOrder.packageId);
        }

        if (!purchaseResult.status) {
          await db
            .update(esimOrdersTable)
            .set({
              status: "failed",
              updatedAt: new Date(),
            })
            .where(eq(esimOrdersTable.id, esimOrder.id));
          console.error(`eSIM purchase failed for esim_order ${esimOrder.id}`);
          continue;
        }

        // Extract eSIM details
        const purchaseData = purchaseResult.data as unknown as Record<
          string,
          unknown
        >;
        const sim = purchaseData.sim as
          | undefined
          | { iccid: string; id: string; status: string };
        const esimId = sim?.id ?? (purchaseData.id as string) ?? null;
        const iccid = sim?.iccid ?? null;
        const simApplied =
          sim !== undefined || (purchaseData.sim_applied as boolean) === true;

        // Try to get activation link
        let activationLink: null | string = null;
        if (esimId) {
          try {
            const myEsims = await getMyEsims();
            const match = myEsims.data?.find((e) => e.id === esimId);
            if (match?.universal_link) {
              activationLink = match.universal_link;
            }
          } catch {
            // Non-critical — user can check dashboard later
          }
        }

        // Update our record
        await db
          .update(esimOrdersTable)
          .set({
            activatedAt: simApplied ? new Date() : null,
            activationLink,
            esimId,
            iccid,
            paymentStatus: "paid",
            status: simApplied ? "active" : "processing",
            updatedAt: new Date(),
          })
          .where(eq(esimOrdersTable.id, esimOrder.id));

        activationItems.push({
          activationLink,
          packageName: esimOrder.packageName,
        });
        console.log(
          `eSIM provisioned for esim_order ${esimOrder.id}: esimId=${esimId}, status=${simApplied ? "active" : "processing"}`,
        );
      } catch (itemError) {
        console.error(
          `Error provisioning eSIM for esim_order ${esimOrder.id}:`,
          itemError,
        );
        await db
          .update(esimOrdersTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(esimOrdersTable.id, esimOrder.id));
      }
    }

    // Update the main order's fulfillment status
    await db
      .update(ordersTable)
      .set({
        fulfillmentStatus: "fulfilled",
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, orderId));

    // Send activation email to customer (guest = no userId; include signup CTA for them)
    const email = order?.email?.trim();
    if (email && activationItems.length > 0) {
      try {
        await sendEsimActivationEmail({
          isGuest: order?.userId == null,
          items: activationItems,
          orderId,
          to: email,
        });
      } catch (emailErr) {
        console.error(
          "[fulfillEsimOrder] Failed to send activation email:",
          emailErr,
        );
      }
    }

    return { esimOrderId: esimOrders[0]?.id, success: true };
  } catch (error) {
    console.error("eSIM fulfillment error:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
}

/**
 * Check if an order contains eSIM items by looking for a linked
 * esim_order record in "pending" payment status.
 */
export async function hasEsimItems(orderId: string): Promise<boolean> {
  const rows = await db
    .select({ id: esimOrdersTable.id })
    .from(esimOrdersTable)
    .where(eq(esimOrdersTable.orderId, orderId))
    .limit(1);
  return rows.length > 0;
}
