import { eq } from "drizzle-orm";

import { db } from "~/db";
import { emailSuppressionTable } from "~/db/schema";

export type SuppressionReason =
  | "bounced_hard"
  | "complaint"
  | "manual"
  | "unsubscribed";

export async function getSuppressionReason(
  email: string,
): Promise<null | SuppressionReason> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select({ reason: emailSuppressionTable.reason })
    .from(emailSuppressionTable)
    .where(eq(emailSuppressionTable.email, normalized))
    .limit(1);
  if (!row?.reason) return null;
  const r = row.reason;
  if (
    r === "bounced_hard" ||
    r === "complaint" ||
    r === "unsubscribed" ||
    r === "manual"
  ) {
    return r;
  }
  return null;
}

export async function removeSuppression(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await db
    .delete(emailSuppressionTable)
    .where(eq(emailSuppressionTable.email, normalized));
}

export async function upsertSuppression(params: {
  email: string;
  notes?: null | string;
  reason: SuppressionReason;
  source?: null | string;
}): Promise<void> {
  const normalized = params.email.trim().toLowerCase();
  await db
    .insert(emailSuppressionTable)
    .values({
      createdAt: new Date(),
      email: normalized,
      notes: params.notes ?? null,
      reason: params.reason,
      source: params.source ?? "system",
    })
    .onConflictDoUpdate({
      set: {
        notes: params.notes ?? null,
        reason: params.reason,
        source: params.source ?? "system",
      },
      target: emailSuppressionTable.email,
    });
}
