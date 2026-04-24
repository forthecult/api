import { eq, sql } from "drizzle-orm";

import { db } from "~/db";
import { userTable } from "~/db/schema";

export async function resolveUserIdByEmail(
  email: string,
): Promise<null | string> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(sql`lower(${userTable.email}) = ${normalized}`)
    .limit(1);
  return row?.id ?? null;
}

export async function userWantsMarketingEmail(
  userId: null | string,
): Promise<boolean> {
  if (!userId) return true;
  const [row] = await db
    .select({ marketingEmail: userTable.marketingEmail })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return row?.marketingEmail ?? true;
}

/** Default true. Guests (`userId` null) are treated as opted in for order emails. */
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
