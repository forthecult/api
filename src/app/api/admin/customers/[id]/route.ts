import { and, desc, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { accountTable } from "~/db/schema";
import { addressesTable, ordersTable } from "~/db/schema";
import { affiliateTable } from "~/db/schema/affiliates/tables";
import { userTable } from "~/db/schema/users/tables";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

const TELEGRAM_PROVIDER_ID = "telegram";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await getAdminAuth(_request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    // TODO: Standardize error response format across admin routes (L20)
    const [user] = await db
      .select({
        createdAt: userTable.createdAt,
        crmNotes: userTable.crmNotes,
        email: userTable.email,
        firstName: userTable.firstName,
        id: userTable.id,
        image: userTable.image,
        interestTags: userTable.interestTags,
        lastName: userTable.lastName,
        marketingAiCompanion: userTable.marketingAiCompanion,
        marketingEmail: userTable.marketingEmail,
        marketingSms: userTable.marketingSms,
        marketingTelegram: userTable.marketingTelegram,
        marketingWebsite: userTable.marketingWebsite,
        name: userTable.name,
        phone: userTable.phone,
        receiveMarketing: userTable.receiveMarketing,
        receiveSmsMarketing: userTable.receiveSmsMarketing,
        sex: userTable.sex,
        transactionalAiCompanion: userTable.transactionalAiCompanion,
        // Notification preferences
        transactionalEmail: userTable.transactionalEmail,
        transactionalSms: userTable.transactionalSms,
        transactionalTelegram: userTable.transactionalTelegram,
        transactionalWebsite: userTable.transactionalWebsite,
        twoFactorEnabled: userTable.twoFactorEnabled,
        updatedAt: userTable.updatedAt,
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

    const [
      orderCountRow,
      latestOrder,
      addresses,
      affiliateRow,
      telegramAccount,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int`.as("count") })
        .from(ordersTable)
        .where(eq(ordersTable.userId, id)),
      db
        .select({
          shippingAddress1: ordersTable.shippingAddress1,
          shippingAddress2: ordersTable.shippingAddress2,
          shippingCity: ordersTable.shippingCity,
          shippingCountryCode: ordersTable.shippingCountryCode,
          shippingStateCode: ordersTable.shippingStateCode,
          shippingZip: ordersTable.shippingZip,
        })
        .from(ordersTable)
        .where(eq(ordersTable.userId, id))
        .orderBy(desc(ordersTable.createdAt))
        .limit(1),
      db
        .select({
          address1: addressesTable.address1,
          address2: addressesTable.address2,
          city: addressesTable.city,
          countryCode: addressesTable.countryCode,
          id: addressesTable.id,
          isDefault: addressesTable.isDefault,
          label: addressesTable.label,
          stateCode: addressesTable.stateCode,
          zip: addressesTable.zip,
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
      addresses: addresses.map((a) => ({
        address1: a.address1,
        address2: a.address2 ?? null,
        city: a.city,
        countryCode: a.countryCode,
        id: a.id,
        isDefault: a.isDefault ?? false,
        label: a.label ?? null,
        stateCode: a.stateCode ?? null,
        zip: a.zip,
      })),
      affiliate: affiliate
        ? { code: affiliate.code, status: affiliate.status }
        : null,
      city: loc?.shippingCity ?? null,
      country: loc?.shippingCountryCode ?? null,
      createdAt: user.createdAt?.toISOString() ?? null,
      crmNotes: user.crmNotes ?? null,
      email: user.email,
      firstName: user.firstName,
      id: user.id,
      image: user.image,
      interestTags: user.interestTags ?? null,
      lastName: user.lastName,
      latestShippingAddress: loc
        ? {
            address1: loc.shippingAddress1 ?? "",
            address2: loc.shippingAddress2 ?? null,
            city: loc.shippingCity ?? "",
            countryCode: loc.shippingCountryCode ?? "",
            stateCode: loc.shippingStateCode ?? null,
            zip: loc.shippingZip ?? "",
          }
        : null,
      name: user.name,
      notificationPreferences: {
        hasTelegramLinked,
        marketing: {
          aiCompanion: user.marketingAiCompanion ?? false,
          email: user.marketingEmail ?? false,
          sms: user.marketingSms ?? false,
          telegram: user.marketingTelegram ?? false,
          website: user.marketingWebsite ?? false,
        },
        transactional: {
          aiCompanion: user.transactionalAiCompanion ?? false,
          email: user.transactionalEmail ?? true,
          sms: user.transactionalSms ?? false,
          telegram: user.transactionalTelegram ?? false,
          website: user.transactionalWebsite ?? true,
        },
      },
      orderCount,
      phone: user.phone,
      receiveMarketing: user.receiveMarketing ?? false,
      receiveSmsMarketing: user.receiveSmsMarketing ?? false,
      sex: user.sex ?? null,
      tokenBalanceCents: null as null | number,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      updatedAt: user.updatedAt?.toISOString() ?? null,
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
    const authResult = await getAdminAuth(request);
    if (!authResult?.ok) return adminAuthFailureResponse(authResult);

    const { id } = await params;
    // TODO: Standardize error response format across admin routes (L20)
    // nanoid uses A-Za-z0-9_-
    const NANOID_RE = /^[A-Za-z0-9_-]{10,40}$/;
    if (!NANOID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }
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
    if (body.sex !== undefined) {
      updates.sex =
        typeof body.sex === "string"
          ? body.sex.trim().slice(0, 64) || null
          : null;
    }
    if (body.interestTags !== undefined) {
      updates.interestTags =
        typeof body.interestTags === "string"
          ? body.interestTags.trim().slice(0, 8000) || null
          : null;
    }
    if (body.crmNotes !== undefined) {
      updates.crmNotes =
        typeof body.crmNotes === "string"
          ? body.crmNotes.trim().slice(0, 16000) || null
          : null;
    }

    // Notification preferences: single source of truth (keeps receiveMarketing/receiveSmsMarketing in sync)
    const prefs = body.notificationPreferences as
      | undefined
      | {
          marketing?: Partial<Record<string, boolean>>;
          transactional?: Partial<Record<string, boolean>>;
        };
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
        crmNotes: userTable.crmNotes,
        firstName: userTable.firstName,
        id: userTable.id,
        interestTags: userTable.interestTags,
        lastName: userTable.lastName,
        phone: userTable.phone,
        receiveMarketing: userTable.receiveMarketing,
        receiveSmsMarketing: userTable.receiveSmsMarketing,
        sex: userTable.sex,
      });
    if (!updated) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      crmNotes: updated.crmNotes ?? null,
      firstName: updated.firstName,
      interestTags: updated.interestTags ?? null,
      lastName: updated.lastName,
      phone: updated.phone ?? null,
      receiveMarketing: updated.receiveMarketing ?? false,
      receiveSmsMarketing: updated.receiveSmsMarketing ?? false,
      sex: updated.sex ?? null,
    });
  } catch (err) {
    console.error("Admin customer PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 },
    );
  }
}
