import { desc, eq } from "drizzle-orm";

import { db } from "~/db";
import { addressesTable } from "~/db/schema";
import { getCurrentUserOrRedirect } from "~/lib/auth";

import { AddressesPageClient } from "./page.client";

export default async function AddressesPage() {
  const user = await getCurrentUserOrRedirect();
  if (!user) return null;
  const addresses = await db
    .select()
    .from(addressesTable)
    .where(eq(addressesTable.userId, user.id))
    .orderBy(desc(addressesTable.createdAt));

  return <AddressesPageClient addresses={addresses} />;
}
