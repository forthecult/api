/**
 * Single source of truth for transactional vs marketing classification
 * and copy for all email/notification types.
 *
 * Classification:
 * - Transactional: triggered by a specific user action or system event
 *   (password reset, order placed, order shipped, refund). Consent: transactional prefs.
 * - Marketing: promotional or re-engagement (welcome, abandon cart, order review).
 *   Consent: marketing prefs.
 */

export const NOTIFICATION_CLASSIFICATION = {
  marketing: [
    "welcome_email",
    "abandon_cart_series",
    "order_review_request",
  ] as const,
  transactional: [
    "password_reset",
    "order_placed",
    "order_processing",
    "order_shipped",
    "order_out_for_delivery",
    "order_on_hold",
    "order_cancelled",
    "refund",
    "refund_request_submitted",
    "support_ticket_reply",
  ] as const,
} as const;

export type MarketingNotificationType =
  (typeof NOTIFICATION_CLASSIFICATION.marketing)[number];
export interface NotificationTemplate {
  /** Short body for widget / push / Telegram */
  body: string;
  /** Plain-text email body (optional; can be built from body + vars) */
  emailBody?: string;
  /** Email subject line */
  emailSubject?: string;
  id: NotificationType;
  /** Short title for widget / push */
  title: string;
  /** Whether this is transactional (true) or marketing (false) */
  transactional: boolean;
}
export type NotificationType =
  | MarketingNotificationType
  | TransactionalNotificationType;

export type TransactionalNotificationType =
  (typeof NOTIFICATION_CLASSIFICATION.transactional)[number];

/** All templates keyed by type. Use for admin copy view and for sending. */
export const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  NotificationTemplate
> = {
  abandon_cart_series: {
    body: "Your cart is waiting. Complete your purchase and we'll get it to you.",
    emailBody:
      "You left items in your cart. Complete your purchase and we'll get them to you.",
    emailSubject: "You left something in your cart",
    id: "abandon_cart_series",
    title: "You left something behind",
    transactional: false,
  },
  order_cancelled: {
    body: "Your order was cancelled. If you didn't request this, please contact support.",
    emailBody:
      "Your order was cancelled. If you didn't request this, please contact support.",
    emailSubject: "Order cancelled",
    id: "order_cancelled",
    title: "Order cancelled",
    transactional: true,
  },
  order_on_hold: {
    body: "Your order is on hold. We'll update you when it's moving again.",
    emailBody:
      "Your order is temporarily on hold. We'll update you when it's moving again.",
    emailSubject: "Order on hold",
    id: "order_on_hold",
    title: "Order on hold",
    transactional: true,
  },
  order_placed: {
    body: "Your order has been received. We'll notify you when it ships.",
    emailBody: "Thanks for your order. We'll send another email when it ships.",
    emailSubject: "Order confirmed",
    id: "order_placed",
    title: "Order confirmed",
    transactional: true,
  },
  order_processing: {
    body: "Your order is being produced. We'll notify you when it ships.",
    emailBody:
      "Your order is now in production. We'll send another email when it ships.",
    emailSubject: "Your order is being made",
    id: "order_processing",
    title: "Order in production",
    transactional: true,
  },
  order_review_request: {
    body: "We'd love to hear what you think. Leave a quick review to help other shoppers.",
    emailBody:
      "Your order was delivered. We'd love to hear what you think—leave a quick review to help other shoppers.",
    emailSubject: "How was your order?",
    id: "order_review_request",
    title: "How was your order?",
    transactional: false,
  },
  order_shipped: {
    body: "Your order has shipped. Track your package with the link below.",
    emailBody:
      "Your order has shipped. You can track it using the tracking link in this email.",
    emailSubject: "Your order has shipped",
    id: "order_shipped",
    title: "Order shipped",
    transactional: true,
  },
  order_out_for_delivery: {
    body: "Your package is out for delivery. Track it with the link in this email.",
    emailBody:
      "Great news — your package is out for delivery with the carrier. Keep an eye on tracking for the exact arrival window.",
    emailSubject: "Your order is out for delivery",
    id: "order_out_for_delivery",
    title: "Out for delivery",
    transactional: true,
  },
  // ---- Transactional ----
  password_reset: {
    body: "We received a request to reset your password. Use the link in this email to set a new password. If you didn't request this, you can ignore this email.",
    emailBody:
      "We received a request to reset your password. Click the link below to set a new password. If you didn't request this, you can ignore this email.",
    emailSubject: "Reset your password",
    id: "password_reset",
    title: "Password reset",
    transactional: true,
  },
  refund: {
    body: "Your refund has been processed. It may take a few days to appear on your statement.",
    emailBody:
      "Your refund has been processed. It may take a few business days to appear on your statement.",
    emailSubject: "Refund processed",
    id: "refund",
    title: "Refund processed",
    transactional: true,
  },
  refund_request_submitted: {
    body: "Your refund request has been submitted. We'll process it and notify you when it's complete.",
    emailBody:
      "We've received your refund request. We'll process it and notify you on your chosen channels when it's complete.",
    emailSubject: "Refund request received",
    id: "refund_request_submitted",
    title: "Refund request received",
    transactional: true,
  },
  support_ticket_reply: {
    body: "You have a new reply on your support ticket.",
    emailBody:
      "Our support team has replied to your ticket. Log in to view the response.",
    emailSubject: "New reply on your support ticket",
    id: "support_ticket_reply",
    title: "Support ticket update",
    transactional: true,
  },
  // ---- Marketing ----
  welcome_email: {
    body: "You're in. The shop's ready when you are.",
    emailBody:
      "You're in. We're glad to have you. The shop's ready when you are.",
    emailSubject: "You're in",
    id: "welcome_email",
    title: "You're in",
    transactional: false,
  },
};

/** Templates for order-related Telegram/widget (orderId + optional tracking). */
export function buildOrderNotificationCopy(
  type:
    | "order_cancelled"
    | "order_on_hold"
    | "order_out_for_delivery"
    | "order_placed"
    | "order_processing"
    | "order_shipped",
  orderId: string,
  options?: { trackingNumber?: string; trackingUrl?: string },
): { body: string; title: string } {
  const shortId = orderId.slice(0, 8);
  switch (type) {
    case "order_cancelled":
      return {
        body: `Order ${shortId} was cancelled.`,
        title: "Order cancelled",
      };
    case "order_on_hold":
      return {
        body: `Order ${shortId} is on hold. We'll update you when it's moving again.`,
        title: "Order on hold",
      };
    case "order_placed":
      return {
        body: `Order ${shortId} has been received. We'll notify you when it ships.`,
        title: "Order confirmed",
      };
    case "order_processing":
      return {
        body: `Order ${shortId} is being produced. We'll notify you when it ships.`,
        title: "Order in production",
      };
    case "order_shipped":
      if (options?.trackingNumber) {
        return {
          body: `Order ${shortId} has shipped. Tracking: ${options.trackingNumber}`,
          title: "Order shipped",
        };
      }
      return { body: `Order ${shortId} has shipped!`, title: "Order shipped" };
    case "order_out_for_delivery":
      return {
        body: `Order ${shortId} is out for delivery with the carrier.`,
        title: "Out for delivery",
      };
    default:
      return { body: `Order ${shortId} status update.`, title: "Order update" };
  }
}

/** All templates as array (for admin list). */
export function getAllNotificationTemplates(): NotificationTemplate[] {
  return Object.values(NOTIFICATION_TEMPLATES);
}

/** Get template by type. */
export function getNotificationTemplate(
  type: NotificationType,
): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[type];
}
