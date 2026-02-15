"use server";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "~/db";
import { addressesTable } from "~/db/schema";
import { getCurrentUser } from "~/lib/auth";

interface CreateInput {
  address1: string;
  address2?: string;
  city: string;
  countryCode: string;
  label?: string;
  phone?: string;
  stateCode?: string;
  zip: string;
}

type UpdateInput = Partial<CreateInput> & { isDefault?: boolean };

export async function createAddress(input: CreateInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const id = createId();
  const now = new Date();
  const isDefault =
    (
      await db
        .select()
        .from(addressesTable)
        .where(eq(addressesTable.userId, user.id))
    ).length === 0;
  await db.insert(addressesTable).values({
    address1: input.address1.trim(),
    address2: input.address2?.trim() ?? null,
    city: input.city.trim(),
    countryCode: input.countryCode.trim(),
    createdAt: now,
    id,
    isDefault,
    label: input.label?.trim() ?? null,
    phone: input.phone?.trim() ?? null,
    stateCode: input.stateCode?.trim() ?? null,
    updatedAt: now,
    userId: user.id,
    zip: input.zip.trim(),
  });
  return { id };
}

export async function deleteAddress(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const [existing] = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.id, id));
  if (!existing || existing.userId !== user.id) return { error: "Not found" };
  await db.delete(addressesTable).where(eq(addressesTable.id, id));
  if (existing.isDefault) {
    const next = await db
      .select()
      .from(addressesTable)
      .where(eq(addressesTable.userId, user.id))
      .limit(1);
    if (next[0]) {
      await db
        .update(addressesTable)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(addressesTable.id, next[0].id));
    }
  }
  return {};
}

export async function setDefaultAddress(id: string) {
  return updateAddress(id, { isDefault: true });
}

export async function updateAddress(id: string, input: UpdateInput) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const [existing] = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.id, id));
  if (!existing || existing.userId !== user.id) return { error: "Not found" };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.address1 !== undefined) updates.address1 = input.address1.trim();
  if (input.address2 !== undefined)
    updates.address2 = input.address2?.trim() ?? null;
  if (input.city !== undefined) updates.city = input.city.trim();
  if (input.stateCode !== undefined)
    updates.stateCode = input.stateCode?.trim() ?? null;
  if (input.zip !== undefined) updates.zip = input.zip.trim();
  if (input.countryCode !== undefined)
    updates.countryCode = input.countryCode.trim();
  if (input.phone !== undefined) updates.phone = input.phone?.trim() ?? null;
  if (input.label !== undefined) updates.label = input.label?.trim() ?? null;
  if (input.isDefault === true) {
    await db
      .update(addressesTable)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addressesTable.userId, user.id));
    updates.isDefault = true;
  }
  await db
    .update(addressesTable)
    .set(updates as never)
    .where(eq(addressesTable.id, id));
  return {};
}
