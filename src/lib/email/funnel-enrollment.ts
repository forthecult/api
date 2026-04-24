import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import { emailFunnelEnrollmentTable } from "~/db/schema";
import { ABANDON_FUNNEL_FIRST_SEND_DELAY_MS } from "~/lib/email/abandon-cart-schedule";
import { WIN_BACK_FIRST_SEND_DELAY_MS } from "~/lib/email/win-back-schedule";

export type EmailFunnelId =
  | "abandon_cart_3"
  | "review_3"
  | "welcome_3"
  | "win_back_3";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Abandon-cart series (caller supplies cart snapshot). Intended for a client beacon or server-side
 * cart-abandonment detector once wired.
 */
export async function enrollAbandonCartMarketingSeries(options: {
  context: Record<string, unknown>;
  email: string;
  experimentVariant: string;
  userId?: null | string;
}): Promise<void> {
  const emailNorm = options.email.trim().toLowerCase();
  if (!emailNorm) return;
  if (await hasActiveEmailFunnelEnrollment(emailNorm, "abandon_cart_3")) return;
  await db.insert(emailFunnelEnrollmentTable).values({
    completed: false,
    context: options.context,
    createdAt: new Date(),
    email: emailNorm,
    experimentVariant: options.experimentVariant,
    funnel: "abandon_cart_3",
    id: createId(),
    lastStepSent: 0,
    nextSendAt: new Date(Date.now() + ABANDON_FUNNEL_FIRST_SEND_DELAY_MS),
    updatedAt: new Date(),
    userId: options.userId ?? null,
  });
}

/** When a package is marked delivered, start the 3-step review + re-engagement series. */
export async function enrollReviewMarketingSeries(options: {
  context: Record<string, unknown>;
  email: string;
  experimentVariant: string;
  userId?: null | string;
}): Promise<void> {
  const emailNorm = options.email.trim().toLowerCase();
  if (!emailNorm) return;
  if (await hasActiveEmailFunnelEnrollment(emailNorm, "review_3")) return;
  await db.insert(emailFunnelEnrollmentTable).values({
    completed: false,
    context: options.context,
    createdAt: new Date(),
    email: emailNorm,
    experimentVariant: options.experimentVariant,
    funnel: "review_3",
    id: createId(),
    lastStepSent: 0,
    nextSendAt: daysFromNow(3),
    updatedAt: new Date(),
    userId: options.userId ?? null,
  });
}

/** After the initial welcome send (step 1), schedule marketing follow-ups at +24h and +72h. */
/**
 * Lapsed buyers: last **delivered** paid order is old, no newer paid activity (enforced in cron SQL).
 * Requires a real `userId` (guest checkout is excluded) so marketing consent is meaningful.
 */
export async function enrollWinBackMarketingSeries(options: {
  context: Record<string, unknown>;
  email: string;
  experimentVariant: string;
  userId: string;
}): Promise<void> {
  const emailNorm = options.email.trim().toLowerCase();
  if (!emailNorm) return;
  const uid = options.userId.trim();
  if (!uid) return;
  if (await hasActiveEmailFunnelEnrollment(emailNorm, "win_back_3")) return;
  await db.insert(emailFunnelEnrollmentTable).values({
    completed: false,
    context: options.context,
    createdAt: new Date(),
    email: emailNorm,
    experimentVariant: options.experimentVariant,
    funnel: "win_back_3",
    id: createId(),
    lastStepSent: 0,
    nextSendAt: new Date(Date.now() + WIN_BACK_FIRST_SEND_DELAY_MS),
    updatedAt: new Date(),
    userId: uid,
  });
}

export async function enrollWelcomeMarketingSeries(options: {
  email: string;
  experimentVariant: string;
  userId?: null | string;
}): Promise<void> {
  const emailNorm = options.email.trim().toLowerCase();
  if (!emailNorm) return;
  if (await hasActiveEmailFunnelEnrollment(emailNorm, "welcome_3")) return;
  await db.insert(emailFunnelEnrollmentTable).values({
    completed: false,
    context: { source: "signup_welcome" },
    createdAt: new Date(),
    email: emailNorm,
    experimentVariant: options.experimentVariant,
    funnel: "welcome_3",
    id: createId(),
    lastStepSent: 1,
    nextSendAt: hoursFromNow(24),
    updatedAt: new Date(),
    userId: options.userId ?? null,
  });
}

export async function hasActiveEmailFunnelEnrollment(
  emailNorm: string,
  funnel: EmailFunnelId,
): Promise<boolean> {
  const [row] = await db
    .select({ id: emailFunnelEnrollmentTable.id })
    .from(emailFunnelEnrollmentTable)
    .where(
      and(
        eq(emailFunnelEnrollmentTable.email, emailNorm),
        eq(emailFunnelEnrollmentTable.funnel, funnel),
        eq(emailFunnelEnrollmentTable.completed, false),
      ),
    )
    .limit(1);
  return Boolean(row);
}

function daysFromNow(d: number): Date {
  return new Date(Date.now() + d * DAY_MS);
}

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * HOUR_MS);
}
