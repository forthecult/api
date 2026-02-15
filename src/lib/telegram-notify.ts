/**
 * Telegram Bot order notifications and transactional notifications.
 *
 * Notifications are sent from OUR backend only (vendor → our webhook → we update order → we send Telegram message).
 * Never from third parties (e.g. Printful) directly to Telegram.
 *
 * Requires TELEGRAM_BOT_TOKEN (same token as Telegram Login Widget / Mini App bot).
 */

import { and, eq } from "drizzle-orm";

import type { TransactionalNotificationType } from "~/lib/notification-templates";

import { db } from "~/db";
import { accountTable, ordersTable, userTable } from "~/db/schema";
import { getServerBaseUrl } from "~/lib/app-url";
import { getNotificationTemplate } from "~/lib/notification-templates";

const TELEGRAM_PROVIDER_ID = "telegram";

export type OrderNotificationKind =
  | "cancelled"
  | "fulfilled"
  | "on_hold"
  | "order_placed"
  | "processing"
  | "shipped";

export interface OrderNotificationOptions {
  kind: OrderNotificationKind;
  /** When true, message and button direct to eSIM dashboard to activate eSIM. */
  isEsimOrder?: boolean;
  trackingNumber?: string;
  trackingUrl?: string;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Send an order status notification to the customer via Telegram when:
 * - Order was placed from the Mini App (order.telegram_user_id), or
 * - User is logged in, has linked Telegram, and opted in to "order notifications via Telegram".
 * Safe to call from webhooks and admin; logs errors and does not throw so callers can still return 200.
 */
export async function notifyOrderUpdate(
  orderId: string,
  options: OrderNotificationOptions,
): Promise<{ error?: string; sent: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return { error: "TELEGRAM_BOT_TOKEN not set", sent: false };
  }

  const chatId = await resolveTelegramChatId(orderId);
  if (!chatId) {
    return { sent: false };
  }
  const text = buildMessage(orderId, options);
  const reply_markup = buildReplyMarkup(orderId, options);

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(reply_markup && { reply_markup }),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(
        `Telegram notify order ${orderId}: ${res.status} ${errBody}`,
      );
      return { error: `${res.status} ${errBody}`, sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.warn("Telegram notify order error:", err);
    return {
      error: err instanceof Error ? err.message : String(err),
      sent: false,
    };
  }
}

/**
 * Send a transactional notification (password_reset, refund) to the user via Telegram.
 * Only sends if user has linked Telegram and transactional Telegram preference is on.
 */
export async function notifyTransactionalTelegram(
  userId: string,
  type: TransactionalNotificationType,
  _vars?: { orderId?: string },
): Promise<{ error?: string; sent: boolean }> {
  const chatId = await resolveTelegramChatIdByUserId(userId);
  if (!chatId) return { sent: false };
  const template = getNotificationTemplate(type);
  const text = `📬 ${template.title}\n\n${template.body}`;
  return sendTelegramMessage(chatId, text);
}

/**
 * Resolve Telegram chat_id for a user by userId when they have linked Telegram
 * and opted in to transactional notifications via Telegram.
 */
export async function resolveTelegramChatIdByUserId(
  userId: string,
): Promise<null | string> {
  const [row] = await db
    .select({
      telegramAccountId: accountTable.accountId,
      transactionalTelegram: userTable.transactionalTelegram,
    })
    .from(userTable)
    .innerJoin(accountTable, eq(accountTable.userId, userTable.id))
    .where(
      and(
        eq(userTable.id, userId),
        eq(accountTable.providerId, TELEGRAM_PROVIDER_ID),
      ),
    )
    .limit(1);

  if (!row?.transactionalTelegram || !row.telegramAccountId) return null;
  return row.telegramAccountId;
}

function buildMessage(
  orderId: string,
  options: OrderNotificationOptions,
): string {
  const shortId = orderId.slice(0, 8);
  switch (options.kind) {
    case "cancelled":
      return `❌ Order ${shortId} was cancelled.`;
    case "fulfilled":
    case "shipped":
      if (options.trackingNumber) {
        return `🚚 Your order ${shortId} has shipped!\n\nTracking: ${options.trackingNumber}`;
      }
      return `🚚 Your order ${shortId} has shipped!`;
    case "on_hold":
      return `⏸ Order ${shortId} is on hold. We'll update you when it's moving again.`;
    case "order_placed":
      if (options.isEsimOrder) {
        return `✅ Thank you for your order. Check your eSIM Dashboard to activate your eSIM.`;
      }
      return `✅ Order ${shortId} confirmed. We'll notify you when it ships.`;
    case "processing":
      return `🏭 Order ${shortId} is in production. We'll notify you when it ships.`;
    default:
      return `Order ${shortId} status update.`;
  }
}

function buildReplyMarkup(
  orderId: string,
  options: OrderNotificationOptions,
):
  | undefined
  | {
      inline_keyboard: {
        text: string;
        url?: string;
        web_app?: { url: string };
      }[][];
    } {
  const appUrl = getAppUrl();
  const buttons: {
    text: string;
    url?: string;
    web_app?: { url: string };
  }[] = [];

  if (options.trackingUrl) {
    buttons.push({ text: "Track package", url: options.trackingUrl });
  }
  if (options.kind === "order_placed" && options.isEsimOrder) {
    buttons.push({
      text: "eSIM Dashboard",
      web_app: { url: `${appUrl}/dashboard/esim` },
    });
  } else {
    buttons.push({
      text: "View order",
      web_app: { url: `${appUrl}/telegram/orders/${orderId}` },
    });
  }

  if (buttons.length === 0) return undefined;
  return { inline_keyboard: [buttons] };
}

function getAppUrl(): string {
  return getServerBaseUrl().replace(/\/$/, "");
}

/**
 * Resolve Telegram chat_id for an order: either from order.telegram_user_id (Mini App) or from the
 * logged-in user's linked Telegram account when they opted in to "order notifications via Telegram".
 */
async function resolveTelegramChatId(orderId: string): Promise<null | string> {
  const [order] = await db
    .select({
      telegramUserId: ordersTable.telegramUserId,
      userId: ordersTable.userId,
    })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order) return null;
  if (order.telegramUserId) return order.telegramUserId;

  if (!order.userId) return null;

  const [userWithAccount] = await db
    .select({
      receiveOrderNotificationsViaTelegram:
        userTable.receiveOrderNotificationsViaTelegram,
      telegramAccountId: accountTable.accountId,
    })
    .from(userTable)
    .innerJoin(accountTable, eq(accountTable.userId, userTable.id))
    .where(
      and(
        eq(userTable.id, order.userId),
        eq(accountTable.providerId, TELEGRAM_PROVIDER_ID),
      ),
    )
    .limit(1);

  if (
    !userWithAccount?.receiveOrderNotificationsViaTelegram ||
    !userWithAccount.telegramAccountId
  ) {
    return null;
  }
  return userWithAccount.telegramAccountId;
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: {
    inline_keyboard: {
      text: string;
      url?: string;
      web_app?: { url: string };
    }[][];
  },
): Promise<{ error?: string; sent: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return { error: "TELEGRAM_BOT_TOKEN not set", sent: false };
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup && { reply_markup: replyMarkup }),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { error: `${res.status} ${errBody}`, sent: false };
    }
    return { sent: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      sent: false,
    };
  }
}
