/**
 * Create in-app (website) notification for the notification widget.
 * Call when sending transactional notifications (order placed, shipped, password reset, refund)
 * if the user has transactional website preference.
 */

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import type { NotificationType } from "~/lib/notification-templates";

import { db } from "~/db";
import {
  orderItemsTable,
  ordersTable,
  supportTicketTable,
  userNotificationTable,
  userTable,
} from "~/db/schema";
import { getNotificationTemplate } from "~/lib/notification-templates";
import {
  enrollReviewMarketingSeries,
} from "~/lib/email/funnel-enrollment";
import { getEmailFunnelCouponExperimentVariant } from "~/lib/email/posthog-email-experiments";
import { markShoppingCartSnapshotsPurchased } from "~/lib/cart/mark-shopping-cart-purchased";
import { sendOrderConfirmationEmail } from "~/lib/send-order-confirmation-email";
import { sendOrderOutForDeliveryEmail } from "~/lib/send-order-out-for-delivery-email";
import { sendOrderShippedEmail } from "~/lib/send-order-shipped-email";
import { sendRefundRequestSubmittedEmail } from "~/lib/send-refund-request-submitted-email";
import {
  notifyOrderUpdate,
  notifyTransactionalTelegram,
} from "~/lib/telegram-notify";

export interface CreateUserNotificationOptions {
  description: string;
  metadata?: Record<string, unknown>;
  title: string;
  type: NotificationType;
  userId: string;
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
    createdAt: new Date(),
    description: options.description,
    id,
    metadata: options.metadata ?? null,
    read: false,
    title: options.title,
    type: options.type,
    userId: options.userId,
  });
  return { id };
}

/**
 * Called when an order is created (Stripe checkout complete, crypto create-order, or admin marks paid).
 * Sends Telegram "order placed", website notification, and order-confirmation email when preferences allow.
 */
export async function onOrderCreated(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      email: ordersTable.email,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return;

  if (order.email?.trim()) {
    void markShoppingCartSnapshotsPurchased({
      email: order.email.trim(),
      userId: order.userId,
    });
  }

  const isEsimOnly = await orderIsEsimOnly(orderId);
  void notifyOrderUpdate(orderId, {
    kind: "order_placed",
    ...(isEsimOnly && { isEsimOrder: true }),
  });

  // Resolve userId for web notification: use order's userId, or look up by order email for guest orders
  let webNotificationUserId: null | string = order.userId;
  if (!webNotificationUserId && order.email?.trim()) {
    const [userByEmail] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, order.email.trim()))
      .limit(1);
    webNotificationUserId = userByEmail?.id ?? null;
  }
  if (
    webNotificationUserId &&
    (await userWantsTransactionalWebsite(webNotificationUserId))
  ) {
    const shortId = orderId.slice(0, 8);
    if (isEsimOnly) {
      await createUserNotification({
        description:
          "Thank you for your order. Check your eSIM Dashboard to activate your eSIM.",
        metadata: { esimDashboardPath: "/dashboard/esim", orderId },
        title: "Order confirmed",
        type: "order_placed",
        userId: webNotificationUserId,
      });
    } else {
      await createUserNotification({
        description: `Order ${shortId} has been received. We'll notify you when it ships.`,
        metadata: { orderId },
        title: "Order confirmed",
        type: "order_placed",
        userId: webNotificationUserId,
      });
    }
  }

  if (
    order.email?.trim() &&
    (await userWantsTransactionalEmail(order.userId))
  ) {
    void sendOrderConfirmationEmail({
      isEsimOrder: isEsimOnly,
      orderId,
      to: order.email.trim(),
    });
  }
}

/**
 * Check if user has transactional email enabled (default true). For guests (no userId), returns true.
 */
export async function userWantsTransactionalEmail(
  userId: null | string,
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

/** True if the order contains only eSIM line items (all item names start with "eSIM:"). */
async function orderIsEsimOnly(orderId: string): Promise<boolean> {
  const items = await db
    .select({ name: orderItemsTable.name })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId));
  if (items.length === 0) return false;
  return items.every((i) => /^eSIM:/i.test(i.name ?? ""));
}

/** Kinds that create a website notification when order status changes. */
const ORDER_STATUS_NOTIFICATION_KINDS = [
  "order_processing",
  "order_shipped",
  "order_out_for_delivery",
  "order_on_hold",
  "order_cancelled",
] as const;

/** Order status kinds that trigger notifications. */
export type OrderStatusKind =
  | "order_cancelled"
  | "order_on_hold"
  | "order_out_for_delivery"
  | "order_processing"
  | "order_shipped";

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
      email: ordersTable.email,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order) return;

  // Map to Telegram notification kind
  let telegramKind: "cancelled" | "fulfilled" | "on_hold" | "processing";
  if (kind === "order_processing") {
    telegramKind = "processing";
  } else if (kind === "order_shipped" || kind === "order_out_for_delivery") {
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
      } else if (kind === "order_out_for_delivery") {
        title = "Out for delivery";
        description = options?.trackingNumber
          ? `Order ${shortId} is out for delivery. Tracking: ${options.trackingNumber}`
          : `Order ${shortId} is out for delivery.`;
      } else if (kind === "order_on_hold") {
        title = "Order on hold";
        description = `Order ${shortId} is on hold. We'll update you when it's moving again.`;
      } else {
        title = "Order cancelled";
        description = `Order ${shortId} was cancelled.`;
      }
      await createUserNotification({
        description,
        metadata: {
          orderId,
          orderStatusPath: `/dashboard/orders/${orderId}`,
          trackingNumber: options?.trackingNumber,
          trackingUrl: options?.trackingUrl,
        },
        title,
        type: kind,
        userId: order.userId,
      });
    }
  }

  if (
    kind === "order_shipped" &&
    order.email?.trim() &&
    (await userWantsTransactionalEmail(order.userId))
  ) {
    void sendOrderShippedEmail({
      orderId,
      to: order.email.trim(),
      trackingNumber: options?.trackingNumber,
      trackingUrl: options?.trackingUrl,
    });
  }

  if (
    kind === "order_out_for_delivery" &&
    order.email?.trim() &&
    (await userWantsTransactionalEmail(order.userId))
  ) {
    void sendOrderOutForDeliveryEmail({
      orderId,
      to: order.email.trim(),
      trackingNumber: options?.trackingNumber,
      trackingUrl: options?.trackingUrl,
    });
  }
}

/**
 * After carrier-confirmed delivery, enroll the 3-step review / re-engagement marketing series.
 * Marketing consent is enforced when each drip email sends.
 */
export async function onOrderDeliveredForReviewFunnel(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      email: ordersTable.email,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order?.email?.trim()) return;

  let userId: null | string = order.userId;
  if (!userId) {
    const [userByEmail] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, order.email.trim()))
      .limit(1);
    userId = userByEmail?.id ?? null;
  }

  const variant = await getEmailFunnelCouponExperimentVariant(
    (userId && userId.trim()) || order.email.trim().toLowerCase(),
    { email: order.email.trim(), userId },
  );

  await enrollReviewMarketingSeries({
    context: { orderId },
    email: order.email.trim(),
    experimentVariant: variant,
    userId,
  });
}

/**
 * Called when a customer submits a refund request. Sends transactional notifications
 * on the channels they have selected (website, email, Telegram).
 */
export async function onRefundRequestSubmitted(orderId: string): Promise<void> {
  const [order] = await db
    .select({
      email: ordersTable.email,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);
  if (!order?.email?.trim()) return;

  let userId: null | string = order.userId;
  if (!userId) {
    const [userByEmail] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, order.email!.trim()))
      .limit(1);
    userId = userByEmail?.id ?? null;
  }

  const template = getNotificationTemplate("refund_request_submitted");
  const shortId = orderId.slice(0, 8);

  if (userId) {
    void notifyTransactionalTelegram(userId, "refund_request_submitted");
    if (await userWantsTransactionalWebsite(userId)) {
      await createUserNotification({
        description: `Order ${shortId}: ${template.body}`,
        metadata: { orderId },
        title: template.title,
        type: "refund_request_submitted",
        userId,
      });
    }
  }

  if (order.email.trim() && (await userWantsTransactionalEmail(userId))) {
    void sendRefundRequestSubmittedEmail({
      orderId,
      to: order.email.trim(),
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
      subject: supportTicketTable.subject,
      userId: supportTicketTable.userId,
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
      description,
      metadata: {
        subject: ticket.subject,
        ticketId,
        ticketPath: `/dashboard/support-tickets/${ticketId}`,
      },
      title: "Support ticket update",
      type: "support_ticket_reply",
      userId: ticket.userId,
    });
  }
}
