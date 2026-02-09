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
  transactional: [
    "password_reset",
    "order_placed",
    "order_processing",
    "order_shipped",
    "order_on_hold",
    "order_cancelled",
    "refund",
    "refund_request_submitted",
    "support_ticket_reply",
  ] as const,
  marketing: [
    "welcome_email",
    "abandon_cart_series",
    "order_review_request",
  ] as const,
} as const;

export type TransactionalNotificationType =
  (typeof NOTIFICATION_CLASSIFICATION.transactional)[number];
export type MarketingNotificationType =
  (typeof NOTIFICATION_CLASSIFICATION.marketing)[number];
export type NotificationType =
  | TransactionalNotificationType
  | MarketingNotificationType;

export interface NotificationTemplate {
  id: NotificationType;
  /** Short title for widget / push */
  title: string;
  /** Short body for widget / push / Telegram */
  body: string;
  /** Email subject line */
  emailSubject?: string;
  /** Plain-text email body (optional; can be built from body + vars) */
  emailBody?: string;
  /** Whether this is transactional (true) or marketing (false) */
  transactional: boolean;
}

/** All templates keyed by type. Use for admin copy view and for sending. */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // ---- Transactional ----
  password_reset: {
    id: "password_reset",
    title: "Password reset",
    body: "We received a request to reset your password. Use the link in this email to set a new password. If you didn't request this, you can ignore this email.",
    emailSubject: "Reset your password",
    emailBody: "We received a request to reset your password. Click the link below to set a new password. If you didn't request this, you can ignore this email.",
    transactional: true,
  },
  order_placed: {
    id: "order_placed",
    title: "Order confirmed",
    body: "Your order has been received. We'll notify you when it ships.",
    emailSubject: "Order confirmed",
    emailBody: "Thanks for your order. We'll send another email when it ships.",
    transactional: true,
  },
  order_processing: {
    id: "order_processing",
    title: "Order in production",
    body: "Your order is being produced. We'll notify you when it ships.",
    emailSubject: "Your order is being made",
    emailBody: "Your order is now in production. We'll send another email when it ships.",
    transactional: true,
  },
  order_shipped: {
    id: "order_shipped",
    title: "Order shipped",
    body: "Your order has shipped. Track your package with the link below.",
    emailSubject: "Your order has shipped",
    emailBody: "Your order has shipped. You can track it using the tracking link in this email.",
    transactional: true,
  },
  order_on_hold: {
    id: "order_on_hold",
    title: "Order on hold",
    body: "Your order is on hold. We'll update you when it's moving again.",
    emailSubject: "Order on hold",
    emailBody: "Your order is temporarily on hold. We'll update you when it's moving again.",
    transactional: true,
  },
  order_cancelled: {
    id: "order_cancelled",
    title: "Order cancelled",
    body: "Your order was cancelled. If you didn't request this, please contact support.",
    emailSubject: "Order cancelled",
    emailBody: "Your order was cancelled. If you didn't request this, please contact support.",
    transactional: true,
  },
  refund: {
    id: "refund",
    title: "Refund processed",
    body: "Your refund has been processed. It may take a few days to appear on your statement.",
    emailSubject: "Refund processed",
    emailBody: "Your refund has been processed. It may take a few business days to appear on your statement.",
    transactional: true,
  },
  refund_request_submitted: {
    id: "refund_request_submitted",
    title: "Refund request received",
    body: "Your refund request has been submitted. We'll process it and notify you when it's complete.",
    emailSubject: "Refund request received",
    emailBody: "We've received your refund request. We'll process it and notify you on your chosen channels when it's complete.",
    transactional: true,
  },
  support_ticket_reply: {
    id: "support_ticket_reply",
    title: "Support ticket update",
    body: "You have a new reply on your support ticket.",
    emailSubject: "New reply on your support ticket",
    emailBody: "Our support team has replied to your ticket. Log in to view the response.",
    transactional: true,
  },
  // ---- Marketing ----
  welcome_email: {
    id: "welcome_email",
    title: "Welcome",
    body: "Thanks for signing up. Explore our store and find something you'll love.",
    emailSubject: "Welcome!",
    emailBody: "Thanks for signing up. We're glad to have you. Explore our store and find something you'll love.",
    transactional: false,
  },
  abandon_cart_series: {
    id: "abandon_cart_series",
    title: "You left something behind",
    body: "Your cart is waiting. Complete your purchase and we'll get it to you.",
    emailSubject: "You left something in your cart",
    emailBody: "You left items in your cart. Complete your purchase and we'll get them to you.",
    transactional: false,
  },
  order_review_request: {
    id: "order_review_request",
    title: "How was your order?",
    body: "We'd love to hear what you think. Leave a quick review to help other shoppers.",
    emailSubject: "How was your order?",
    emailBody: "Your order was delivered. We'd love to hear what you think—leave a quick review to help other shoppers.",
    transactional: false,
  },
};

/** Get template by type. */
export function getNotificationTemplate(
  type: NotificationType,
): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[type];
}

/** All templates as array (for admin list). */
export function getAllNotificationTemplates(): NotificationTemplate[] {
  return Object.values(NOTIFICATION_TEMPLATES);
}

/** Templates for order-related Telegram/widget (orderId + optional tracking). */
export function buildOrderNotificationCopy(
  type: "order_placed" | "order_processing" | "order_shipped" | "order_on_hold" | "order_cancelled",
  orderId: string,
  options?: { trackingNumber?: string; trackingUrl?: string },
): { title: string; body: string } {
  const shortId = orderId.slice(0, 8);
  switch (type) {
    case "order_placed":
      return {
        title: "Order confirmed",
        body: `Order ${shortId} has been received. We'll notify you when it ships.`,
      };
    case "order_processing":
      return {
        title: "Order in production",
        body: `Order ${shortId} is being produced. We'll notify you when it ships.`,
      };
    case "order_shipped":
      if (options?.trackingNumber) {
        return {
          title: "Order shipped",
          body: `Order ${shortId} has shipped. Tracking: ${options.trackingNumber}`,
        };
      }
      return { title: "Order shipped", body: `Order ${shortId} has shipped!` };
    case "order_on_hold":
      return {
        title: "Order on hold",
        body: `Order ${shortId} is on hold. We'll update you when it's moving again.`,
      };
    case "order_cancelled":
      return {
        title: "Order cancelled",
        body: `Order ${shortId} was cancelled.`,
      };
    default:
      return { title: "Order update", body: `Order ${shortId} status update.` };
  }
}
