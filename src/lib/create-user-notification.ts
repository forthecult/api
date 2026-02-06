/**
 * Create in-app (website) notification for the notification widget.
 * Call when sending transactional notifications (order placed, shipped, password reset, refund)
 * if the user has transactional website preference.
 */

import { eq } from "drizzle-orm";

import { db } from "~/db";
import {
  userNotificationTable,
  userTable,
  ordersTable,
  supportTicketTable,
} from "~/db/schema";
import type { NotificationType } from "~/lib/notification-templates";
import { createId } from "@paralleldrive/cuid2";
import { sendOrderShippedEmail } from "~/lib/send-order-shipped-email";
import { notifyOrderUpdate } from "~/lib/telegram-notify";

export interface CreateUserNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Insert a notification for the website widget. Caller should check user preference
 * (transactionalWebsite) before calling if needed.
 */
export async function createUserNotification(
  options: CreateUserNotificationOptions,
): Promise<{ id: string }> {
  const id = createId();
  await db.insert(userNotificationTable).values({
    id,
    userId: options.userId,
    type: options.type,
    title: options.title,
    description: options.description,
    metadata: options.metadata ?? null,
    read: false,
    createdAt: new Date(),
  });
  return { id };
}

/**
 * Check if user has transactional website notifications enabled (default true).
 */
export async function userWantsTransactionalWebsite(
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ transactionalWebsite: userTable.transactionalWebsite })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.transactionalWebsite ?? true;
}

/**
 * Check if user has transactional email enabled (default true). For guests (no userId), returns true.
 */
export async function userWantsTransactionalEmail(
  userId: string | null,
): Promise<boolean> {
  if (!userId) return true;
  const [row] = await db
    .select({ transactionalEmail: userTable.transactionalEmail })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.transactionalEmail ?? true;
}

/**
 * Called when an order is created (Stripe checkout complete or crypto create-order).
 * Sends Telegram "order placed" if user has it enabled, and creates website notification
 * if user has transactional website enabled.
 */
export async function onOrderCreated(orderId: string): Promise<void> {
  const [order] = await db
    .select({ userId: ordersTable.userId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return;

  void notifyOrderUpdate(orderId, { kind: "order_placed" });

  if (order.userId && (await userWantsTransactionalWebsite(order.userId))) {
    const shortId = orderId.slice(0, 8);
    await createUserNotification({
      userId: order.userId,
      type: "order_placed",
      title: "Order confirmed",
      description: `Order ${shortId} has been received. We'll notify you when it ships.`,
      metadata: { orderId },
    });
  }
}

/** Kinds that create a website notification when order status changes. */
const ORDER_STATUS_NOTIFICATION_KINDS = [
  "order_processing",
  "order_shipped",
  "order_on_hold",
  "order_cancelled",
] as const;

/** Order status kinds that trigger notifications. */
export type OrderStatusKind =
  | "order_processing"
  | "order_shipped"
  | "order_on_hold"
  | "order_cancelled";

/**
 * Called when order status changes (processing, shipped, on_hold, cancelled). Sends Telegram,
 * website notification, and transactional email (for order_shipped) when preferences allow.
 */
export async function onOrderStatusUpdate(
  orderId: string,
  kind: OrderStatusKind,
  options?: { trackingNumber?: string; trackingUrl?: string },
): Promise<void> {
  const [order] = await db
    .select({
      userId: ordersTable.userId,
      email: ordersTable.email,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return;

  // Map to Telegram notification kind
  let telegramKind: "processing" | "fulfilled" | "on_hold" | "cancelled";
  if (kind === "order_processing") {
    telegramKind = "processing";
  } else if (kind === "order_shipped") {
    telegramKind = "fulfilled";
  } else if (kind === "order_on_hold") {
    telegramKind = "on_hold";
  } else {
    telegramKind = "cancelled";
  }

  void notifyOrderUpdate(orderId, {
    kind: telegramKind,
    trackingNumber: options?.trackingNumber,
    trackingUrl: options?.trackingUrl,
  });

  if (order.userId && ORDER_STATUS_NOTIFICATION_KINDS.includes(kind)) {
    if (await userWantsTransactionalWebsite(order.userId)) {
      const shortId = orderId.slice(0, 8);
      let title: string;
      let description: string;
      if (kind === "order_processing") {
        title = "Order in production";
        description = `Order ${shortId} is being produced. We'll notify you when it ships.`;
      } else if (kind === "order_shipped") {
        title = "Order shipped";
        description = options?.trackingNumber
          ? `Order ${shortId} has shipped. Tracking: ${options.trackingNumber}`
          : `Order ${shortId} has shipped!`;
      } else if (kind === "order_on_hold") {
        title = "Order on hold";
        description = `Order ${shortId} is on hold. We'll update you when it's moving again.`;
      } else {
        title = "Order cancelled";
        description = `Order ${shortId} was cancelled.`;
      }
      await createUserNotification({
        userId: order.userId,
        type: kind,
        title,
        description,
        metadata: {
          orderId,
          orderStatusPath: `/dashboard/orders/${orderId}`,
          trackingNumber: options?.trackingNumber,
          trackingUrl: options?.trackingUrl,
        },
      });
    }
  }

  if (
    kind === "order_shipped" &&
    order.email?.trim() &&
    (await userWantsTransactionalEmail(order.userId))
  ) {
    void sendOrderShippedEmail({
      to: order.email.trim(),
      orderId,
      trackingNumber: options?.trackingNumber,
      trackingUrl: options?.trackingUrl,
    });
  }
}

/**
 * Called when staff replies to a support ticket. Creates a website notification
 * for the customer if they have transactional website notifications enabled.
 */
export async function onSupportTicketReply(
  ticketId: string,
  options?: { messagePreview?: string },
): Promise<void> {
  const [ticket] = await db
    .select({
      userId: supportTicketTable.userId,
      subject: supportTicketTable.subject,
    })
    .from(supportTicketTable)
    .where(eq(supportTicketTable.id, ticketId))
    .limit(1);

  if (!ticket?.userId) return;

  if (await userWantsTransactionalWebsite(ticket.userId)) {
    const subjectPreview =
      ticket.subject.length > 30
        ? `${ticket.subject.slice(0, 30)}...`
        : ticket.subject;

    let description = `New reply on "${subjectPreview}"`;
    if (options?.messagePreview) {
      const preview =
        options.messagePreview.length > 50
          ? `${options.messagePreview.slice(0, 50)}...`
          : options.messagePreview;
      description = `${description}: "${preview}"`;
    }

    await createUserNotification({
      userId: ticket.userId,
      type: "support_ticket_reply",
      title: "Support ticket update",
      description,
      metadata: {
        ticketId,
        ticketPath: `/dashboard/support/${ticketId}`,
        subject: ticket.subject,
      },
    });
  }
}
