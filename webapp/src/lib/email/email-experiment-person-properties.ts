import "server-only";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "~/db";
import { accountTable, userTable } from "~/db/schema";

/**
 * Person properties for PostHog flag evaluation (multivariate drip / coupon tests).
 * Values are strings only — PostHog Node API contract. No full email address (domain only).
 */
export async function buildEmailFunnelPersonPropertiesForPostHog(
  userId: null | string | undefined,
  email?: string,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  const domain = email ? domainFromEmail(email) : null;
  if (domain) out.email_domain = domain;

  if (!userId?.trim()) {
    out.shopper_type = "guest";
    return out;
  }

  out.shopper_type = "registered";

  const [user] = await db
    .select({
      age: userTable.age,
      crmNotes: userTable.crmNotes,
      interestTags: userTable.interestTags,
      receiveMarketing: userTable.receiveMarketing,
      sex: userTable.sex,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (user) {
    if (user.age != null) out.age_bucket = ageBucket(user.age);
    out.receive_marketing = user.receiveMarketing ? "true" : "false";
    if (user.sex?.trim()) {
      const s = user.sex.trim().toLowerCase();
      out.sex_bucket = s.slice(0, 48);
    }
    if (user.interestTags?.trim()) {
      const t = user.interestTags.trim().replace(/\s+/g, " ");
      out.interest_tags_preview = t.length > 400 ? `${t.slice(0, 400)}…` : t;
    }
    out.has_crm_notes = user.crmNotes?.trim() ? "true" : "false";
  }

  const [wallet] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        inArray(accountTable.providerId, ["ethereum", "solana"]),
      ),
    )
    .limit(1);
  out.web3_linked = wallet ? "true" : "false";

  return out;
}

function ageBucket(age: number): string {
  if (age < 18) return "under_18";
  if (age <= 24) return "18_24";
  if (age <= 34) return "25_34";
  if (age <= 44) return "35_44";
  if (age <= 54) return "45_54";
  return "55_plus";
}

function domainFromEmail(email: string): null | string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  return e.slice(at + 1);
}
