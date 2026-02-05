import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable } from "~/db/schema";
import { affiliateTable } from "~/db/schema/affiliates/tables";
import { addressesTable, ordersTable } from "~/db/schema";
import { userTable } from "~/db/schema/users/tables";
import { auth, isAdminUser } from "~/lib/auth";

const TELEGRAM_PROVIDER_ID = "telegram";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: _request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [user] = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        image: userTable.image,
        email: userTable.email,
        phone: userTable.phone,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
        twoFactorEnabled: userTable.twoFactorEnabled,
        receiveMarketing: userTable.receiveMarketing,
        receiveSmsMarketing: userTable.receiveSmsMarketing,
        // Notification preferences
        transactionalEmail: userTable.transactionalEmail,
        transactionalWebsite: userTable.transactionalWebsite,
        transactionalSms: userTable.transactionalSms,
        transactionalTelegram: userTable.transactionalTelegram,
        transactionalAiCompanion: userTable.transactionalAiCompanion,
        marketingEmail: userTable.marketingEmail,
        marketingWebsite: userTable.marketingWebsite,
        marketingSms: userTable.marketingSms,
        marketingTelegram: userTable.marketingTelegram,
        marketingAiCompanion: userTable.marketingAiCompanion,
      })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    const [orderCountRow, latestOrder, addresses, affiliateRow, telegramAccount] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int`.as("count") })
          .from(ordersTable)
          .where(eq(ordersTable.userId, id)),
        db
          .select({
            shippingAddress1: ordersTable.shippingAddress1,
            shippingAddress2: ordersTable.shippingAddress2,
            shippingCity: ordersTable.shippingCity,
            shippingStateCode: ordersTable.shippingStateCode,
            shippingZip: ordersTable.shippingZip,
            shippingCountryCode: ordersTable.shippingCountryCode,
          })
          .from(ordersTable)
          .where(eq(ordersTable.userId, id))
          .orderBy(desc(ordersTable.createdAt))
          .limit(1),
        db
          .select({
            id: addressesTable.id,
            address1: addressesTable.address1,
            address2: addressesTable.address2,
            city: addressesTable.city,
            stateCode: addressesTable.stateCode,
            countryCode: addressesTable.countryCode,
            zip: addressesTable.zip,
            label: addressesTable.label,
            isDefault: addressesTable.isDefault,
          })
          .from(addressesTable)
          .where(eq(addressesTable.userId, id)),
        db
          .select({
            code: affiliateTable.code,
            status: affiliateTable.status,
          })
          .from(affiliateTable)
          .where(eq(affiliateTable.userId, id))
          .limit(1),
        db
          .select({ accountId: accountTable.accountId })
          .from(accountTable)
          .where(
            and(
              eq(accountTable.userId, id),
              eq(accountTable.providerId, TELEGRAM_PROVIDER_ID),
            ),
          )
          .limit(1),
      ]);

    const orderCount = orderCountRow[0]?.count ?? 0;
    const loc = latestOrder[0];
    const affiliate = affiliateRow[0];
    const hasTelegramLinked = Boolean(telegramAccount[0]?.accountId);

    return NextResponse.json({
      id: user.id,
      name: user.name,
      image: user.image,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt?.toISOString() ?? null,
      updatedAt: user.updatedAt?.toISOString() ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      orderCount,
      tokenBalanceCents: null as number | null,
      city: loc?.shippingCity ?? null,
      country: loc?.shippingCountryCode ?? null,
      latestShippingAddress: loc
        ? {
            address1: loc.shippingAddress1 ?? "",
            address2: loc.shippingAddress2 ?? null,
            city: loc.shippingCity ?? "",
            stateCode: loc.shippingStateCode ?? null,
            countryCode: loc.shippingCountryCode ?? "",
            zip: loc.shippingZip ?? "",
          }
        : null,
      addresses: addresses.map((a) => ({
        id: a.id,
        address1: a.address1,
        address2: a.address2 ?? null,
        city: a.city,
        stateCode: a.stateCode ?? null,
        countryCode: a.countryCode,
        zip: a.zip,
        label: a.label ?? null,
        isDefault: a.isDefault ?? false,
      })),
      receiveMarketing: user.receiveMarketing ?? false,
      receiveSmsMarketing: user.receiveSmsMarketing ?? false,
      affiliate: affiliate
        ? { code: affiliate.code, status: affiliate.status }
        : null,
      notificationPreferences: {
        hasTelegramLinked,
        transactional: {
          email: user.transactionalEmail ?? true,
          website: user.transactionalWebsite ?? true,
          sms: user.transactionalSms ?? false,
          telegram: user.transactionalTelegram ?? false,
          aiCompanion: user.transactionalAiCompanion ?? false,
        },
        marketing: {
          email: user.marketingEmail ?? false,
          website: user.marketingWebsite ?? false,
          sms: user.marketingSms ?? false,
          telegram: user.marketingTelegram ?? false,
          aiCompanion: user.marketingAiCompanion ?? false,
        },
      },
    });
  } catch (err) {
    console.error("Admin customer get error:", err);
    return NextResponse.json(
      { error: "Failed to load customer" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const updates: Record<string, unknown> = {};
    if (body.firstName !== undefined) {
      updates.firstName =
        typeof body.firstName === "string" ? body.firstName : null;
    }
    if (body.lastName !== undefined) {
      updates.lastName =
        typeof body.lastName === "string" ? body.lastName : null;
    }
    if (body.phone !== undefined) {
      updates.phone =
        typeof body.phone === "string" ? body.phone.trim() || null : null;
    }

    // Notification preferences: single source of truth (keeps receiveMarketing/receiveSmsMarketing in sync)
    const prefs = body.notificationPreferences as
      | {
          transactional?: Partial<Record<string, boolean>>;
          marketing?: Partial<Record<string, boolean>>;
        }
      | undefined;
    if (prefs?.transactional) {
      if (typeof prefs.transactional.email === "boolean") {
        updates.transactionalEmail = prefs.transactional.email;
      }
      if (typeof prefs.transactional.website === "boolean") {
        updates.transactionalWebsite = prefs.transactional.website;
      }
      if (typeof prefs.transactional.sms === "boolean") {
        updates.transactionalSms = prefs.transactional.sms;
      }
      if (typeof prefs.transactional.telegram === "boolean") {
        updates.transactionalTelegram = prefs.transactional.telegram;
      }
      if (typeof prefs.transactional.aiCompanion === "boolean") {
        updates.transactionalAiCompanion = prefs.transactional.aiCompanion;
      }
    }
    if (prefs?.marketing) {
      if (typeof prefs.marketing.email === "boolean") {
        updates.marketingEmail = prefs.marketing.email;
        updates.receiveMarketing = prefs.marketing.email;
      }
      if (typeof prefs.marketing.website === "boolean") {
        updates.marketingWebsite = prefs.marketing.website;
      }
      if (typeof prefs.marketing.sms === "boolean") {
        updates.marketingSms = prefs.marketing.sms;
        updates.receiveSmsMarketing = prefs.marketing.sms;
      }
      if (typeof prefs.marketing.telegram === "boolean") {
        updates.marketingTelegram = prefs.marketing.telegram;
      }
      if (typeof prefs.marketing.aiCompanion === "boolean") {
        updates.marketingAiCompanion = prefs.marketing.aiCompanion;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(userTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userTable.id, id))
      .returning({
        id: userTable.id,
        firstName: userTable.firstName,
        lastName: userTable.lastName,
        phone: userTable.phone,
        receiveMarketing: userTable.receiveMarketing,
        receiveSmsMarketing: userTable.receiveSmsMarketing,
      });
    if (!updated) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone ?? null,
      receiveMarketing: updated.receiveMarketing ?? false,
      receiveSmsMarketing: updated.receiveSmsMarketing ?? false,
    });
  } catch (err) {
    console.error("Admin customer PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 },
    );
  }
}
