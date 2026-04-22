import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/db";
import { paymentMethodSettingTable } from "~/db/schema";
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";
import {
  PAYMENT_METHOD_DEFAULTS,
  type PaymentMethodSetting,
} from "~/lib/payment-method-settings";

const now = new Date();

/**
 * GET /api/admin/payment-methods
 * Admin: list all payment methods with enabled flag (for admin UI).
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  const rows = await db
    .select({
      displayOrder: paymentMethodSettingTable.displayOrder,
      enabled: paymentMethodSettingTable.enabled,
      enabledNetworks: paymentMethodSettingTable.enabledNetworks,
      label: paymentMethodSettingTable.label,
      methodKey: paymentMethodSettingTable.methodKey,
    })
    .from(paymentMethodSettingTable)
    .orderBy(paymentMethodSettingTable.displayOrder);

  const byKey = new Map(
    rows.map((r) => [
      r.methodKey,
      {
        displayOrder: r.displayOrder,
        enabled: r.enabled,
        enabledNetworks: Array.isArray(r.enabledNetworks)
          ? r.enabledNetworks
          : null,
        label: r.label,
        methodKey: r.methodKey,
      },
    ]),
  );

  // Always merge PAYMENT_METHOD_DEFAULTS so new methods appear in admin without a separate migration
  const list: PaymentMethodSetting[] = [];
  const toInsert: (typeof PAYMENT_METHOD_DEFAULTS)[number][] = [];
  for (const d of PAYMENT_METHOD_DEFAULTS) {
    const existing = byKey.get(d.methodKey);
    if (existing) {
      list.push({
        displayOrder: existing.displayOrder,
        enabled: existing.enabled,
        enabledNetworks: existing.enabledNetworks,
        label: existing.label,
        methodKey: existing.methodKey,
      });
    } else {
      toInsert.push(d);
      list.push({
        displayOrder: d.displayOrder,
        enabled: true,
        label: d.label,
        methodKey: d.methodKey,
      });
    }
  }
  list.sort((a, b) => a.displayOrder - b.displayOrder);

  // New methods from PAYMENT_METHOD_DEFAULTS are inserted disabled so they don't appear until admin enables them.
  if (toInsert.length > 0) {
    for (const d of toInsert) {
      await db.insert(paymentMethodSettingTable).values({
        createdAt: now,
        displayOrder: d.displayOrder,
        enabled: false,
        label: d.label,
        methodKey: d.methodKey,
        updatedAt: now,
      });
    }
  }

  return NextResponse.json({ data: list });
}

/**
 * PATCH /api/admin/payment-methods
 * Admin: enable or disable a payment method, and/or set enabled networks.
 * Body: { methodKey: string, enabled?: boolean, enabledNetworks?: string[] | null }
 */
export async function PATCH(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) return adminAuthFailureResponse(authResult);

  let body: {
    enabled?: boolean;
    enabledNetworks?: null | string[];
    methodKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const methodKey = body.methodKey?.trim();
  const enabled = body.enabled;
  const enabledNetworks =
    body.enabledNetworks === null || Array.isArray(body.enabledNetworks)
      ? body.enabledNetworks
      : undefined;

  if (!methodKey) {
    return NextResponse.json(
      { error: "methodKey is required" },
      { status: 400 },
    );
  }
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean when provided" },
      { status: 400 },
    );
  }

  const exists = await db
    .select({ methodKey: paymentMethodSettingTable.methodKey })
    .from(paymentMethodSettingTable)
    .where(eq(paymentMethodSettingTable.methodKey, methodKey))
    .limit(1);

  const updatePayload: {
    enabled?: boolean;
    enabledNetworks?: null | string[];
    updatedAt: Date;
  } = { updatedAt: now };
  if (enabled !== undefined) updatePayload.enabled = enabled;
  if (enabledNetworks !== undefined)
    updatePayload.enabledNetworks = enabledNetworks;

  if (exists.length > 0) {
    await db
      .update(paymentMethodSettingTable)
      .set(updatePayload)
      .where(eq(paymentMethodSettingTable.methodKey, methodKey));
  } else {
    const def = PAYMENT_METHOD_DEFAULTS.find((d) => d.methodKey === methodKey);
    if (!def) {
      return NextResponse.json(
        { error: `Unknown methodKey: ${methodKey}` },
        { status: 400 },
      );
    }
    await db.insert(paymentMethodSettingTable).values({
      createdAt: now,
      displayOrder: def.displayOrder,
      enabled: enabled ?? true,
      enabledNetworks: enabledNetworks ?? null,
      label: def.label,
      methodKey: def.methodKey,
      updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true });
}
