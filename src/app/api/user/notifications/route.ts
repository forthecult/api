import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable, userTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import type {
  ChannelPreferences,
  NotificationPreferences,
} from "~/lib/user-notification-preferences";

const TELEGRAM_PROVIDER_ID = "telegram";

/**
 * GET /api/user/notifications
 * Returns current user's notification preferences and whether they have Telegram linked.
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user] = await db
    .select({
      // Transactional preferences
      transactionalEmail: userTable.transactionalEmail,
      transactionalWebsite: userTable.transactionalWebsite,
      transactionalSms: userTable.transactionalSms,
      transactionalTelegram: userTable.transactionalTelegram,
      transactionalAiCompanion: userTable.transactionalAiCompanion,
      // Marketing preferences
      marketingEmail: userTable.marketingEmail,
      marketingWebsite: userTable.marketingWebsite,
      marketingSms: userTable.marketingSms,
      marketingTelegram: userTable.marketingTelegram,
      marketingAiCompanion: userTable.marketingAiCompanion,
      // Legacy fields
      receiveOrderNotificationsViaTelegram: userTable.receiveOrderNotificationsViaTelegram,
      receiveMarketing: userTable.receiveMarketing,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const [telegramAccount] = await db
    .select({ accountId: accountTable.accountId })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, TELEGRAM_PROVIDER_ID),
      ),
    )
    .limit(1);

  const hasTelegramLinked = Boolean(telegramAccount?.accountId);

  return NextResponse.json({
    hasTelegramLinked,
    transactional: {
      email: user?.transactionalEmail ?? true,
      website: user?.transactionalWebsite ?? true,
      sms: user?.transactionalSms ?? false,
      telegram: user?.transactionalTelegram ?? false,
      aiCompanion: user?.transactionalAiCompanion ?? false,
    },
    marketing: {
      email: user?.marketingEmail ?? false,
      website: user?.marketingWebsite ?? false,
      sms: user?.marketingSms ?? false,
      telegram: user?.marketingTelegram ?? false,
      aiCompanion: user?.marketingAiCompanion ?? false,
    },
    // Legacy fields
    receiveOrderNotificationsViaTelegram: user?.receiveOrderNotificationsViaTelegram ?? false,
    receiveMarketing: user?.receiveMarketing ?? false,
  } satisfies NotificationPreferences);
}

// Type for update body
type NotificationUpdateBody = {
  transactional?: Partial<ChannelPreferences>;
  marketing?: Partial<ChannelPreferences>;
  // Legacy fields
  receiveOrderNotificationsViaTelegram?: boolean;
  receiveMarketing?: boolean;
};

/**
 * PATCH /api/user/notifications
 * Body: { 
 *   transactional?: { email?: boolean, website?: boolean, sms?: boolean, telegram?: boolean, aiCompanion?: boolean },
 *   marketing?: { email?: boolean, website?: boolean, sms?: boolean, telegram?: boolean, aiCompanion?: boolean },
 *   receiveOrderNotificationsViaTelegram?: boolean, 
 *   receiveMarketing?: boolean 
 * }
 * Telegram preferences are only applied when user has Telegram linked.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  let body: NotificationUpdateBody;
  try {
    body = (await request.json()) as NotificationUpdateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [telegramAccount] = await db
    .select({ accountId: accountTable.accountId })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, TELEGRAM_PROVIDER_ID),
      ),
    )
    .limit(1);

  const hasTelegramLinked = Boolean(telegramAccount?.accountId);

  const updates: Record<string, boolean> = {};

  // Process transactional preferences
  if (body.transactional) {
    if (typeof body.transactional.email === "boolean") {
      updates.transactionalEmail = body.transactional.email;
    }
    if (typeof body.transactional.website === "boolean") {
      updates.transactionalWebsite = body.transactional.website;
    }
    if (typeof body.transactional.sms === "boolean") {
      updates.transactionalSms = body.transactional.sms;
    }
    if (typeof body.transactional.telegram === "boolean" && hasTelegramLinked) {
      updates.transactionalTelegram = body.transactional.telegram;
    }
    if (typeof body.transactional.aiCompanion === "boolean") {
      updates.transactionalAiCompanion = body.transactional.aiCompanion;
    }
  }

  // Process marketing preferences
  if (body.marketing) {
    if (typeof body.marketing.email === "boolean") {
      updates.marketingEmail = body.marketing.email;
      // Also update legacy field for backward compatibility
      updates.receiveMarketing = body.marketing.email;
    }
    if (typeof body.marketing.website === "boolean") {
      updates.marketingWebsite = body.marketing.website;
    }
    if (typeof body.marketing.sms === "boolean") {
      updates.marketingSms = body.marketing.sms;
      // Also update legacy field for backward compatibility
      updates.receiveSmsMarketing = body.marketing.sms;
    }
    if (typeof body.marketing.telegram === "boolean" && hasTelegramLinked) {
      updates.marketingTelegram = body.marketing.telegram;
    }
    if (typeof body.marketing.aiCompanion === "boolean") {
      updates.marketingAiCompanion = body.marketing.aiCompanion;
    }
  }

  // Legacy field updates (for backward compatibility)
  if (typeof body.receiveMarketing === "boolean") {
    updates.receiveMarketing = body.receiveMarketing;
    updates.marketingEmail = body.receiveMarketing;
  }
  if (typeof body.receiveOrderNotificationsViaTelegram === "boolean" && hasTelegramLinked) {
    updates.receiveOrderNotificationsViaTelegram = body.receiveOrderNotificationsViaTelegram;
    updates.transactionalTelegram = body.receiveOrderNotificationsViaTelegram;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ updated: false });
  }

  await db
    .update(userTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userTable.id, userId));

  return NextResponse.json({ updated: true });
}
