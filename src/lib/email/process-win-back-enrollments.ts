import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "~/db";
import { emailFunnelEnrollmentTable, ordersTable } from "~/db/schema";
import { userWantsMarketingEmail } from "~/lib/email/consent";
import {
  enrollWinBackMarketingSeries,
  hasActiveEmailFunnelEnrollment,
} from "~/lib/email/funnel-enrollment";
import { getEmailFunnelCouponExperimentVariant } from "~/lib/email/posthog-email-experiments";
import {
  WIN_BACK_FUNNEL_COOLDOWN_DAYS,
  WIN_BACK_IDLE_DAYS,
} from "~/lib/email/win-back-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Enrolls signed-in customers into the 3-step win-back series when their **last delivered**
 * paid order is older than {@link WIN_BACK_IDLE_DAYS}, they have **not** placed a newer paid
 * order since that delivery, they allow marketing email, and they are outside the cooldown
 * window for a prior `win_back_3` enrollment.
 */
export async function processWinBackEnrollments(): Promise<{
  enrolled: number;
}> {
  const idleCutoff = new Date(Date.now() - WIN_BACK_IDLE_DAYS * DAY_MS);
  const cooldownCutoff = new Date(
    Date.now() - WIN_BACK_FUNNEL_COOLDOWN_DAYS * DAY_MS,
  );

  const candidateRows = await db.execute(sql`
    WITH per_email AS (
      SELECT
        lower(trim(${ordersTable.email})) AS email_norm,
        max(${ordersTable.deliveredAt}) AS last_delivered_at,
        (array_agg(${ordersTable.id} ORDER BY ${ordersTable.deliveredAt} DESC))[1] AS anchor_order_id,
        (array_agg(${ordersTable.userId} ORDER BY ${ordersTable.deliveredAt} DESC)
          FILTER (WHERE ${ordersTable.userId} IS NOT NULL))[1] AS user_id
      FROM ${ordersTable}
      WHERE ${ordersTable.paymentStatus} IN ('paid', 'confirmed')
        AND ${ordersTable.deliveredAt} IS NOT NULL
        AND ${ordersTable.deliveredAt} < ${idleCutoff}
        AND ${ordersTable.userId} IS NOT NULL
      GROUP BY 1
    ),
    paid_after AS (
      SELECT
        lower(trim(${ordersTable.email})) AS email_norm,
        max(${ordersTable.createdAt}) AS last_paid_at
      FROM ${ordersTable}
      WHERE ${ordersTable.paymentStatus} IN ('paid', 'confirmed')
        AND (
          ${ordersTable.status} IS NULL
          OR lower(${ordersTable.status}) NOT IN ('cancelled', 'refunded')
        )
      GROUP BY 1
    )
    SELECT
      pe.email_norm,
      pe.user_id,
      pe.anchor_order_id,
      pe.last_delivered_at
    FROM per_email pe
    INNER JOIN paid_after pa ON pa.email_norm = pe.email_norm
    WHERE pa.last_paid_at <= pe.last_delivered_at + interval '2 days'
    LIMIT 80
  `);

  const rowsUnknown = candidateRows as unknown;
  const rawRows = Array.isArray(rowsUnknown)
    ? rowsUnknown
    : (rowsUnknown as { rows?: unknown[] }).rows ?? [];

  let enrolled = 0;
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const emailNorm = typeof r.email_norm === "string" ? r.email_norm : "";
    const userId = typeof r.user_id === "string" ? r.user_id : "";
    const anchorOrderId =
      typeof r.anchor_order_id === "string" ? r.anchor_order_id : "";
    if (!emailNorm || !userId || !anchorOrderId) continue;

    const lastDelivered =
      r.last_delivered_at instanceof Date
        ? r.last_delivered_at
        : typeof r.last_delivered_at === "string"
          ? new Date(r.last_delivered_at)
          : null;
    if (!lastDelivered || Number.isNaN(lastDelivered.getTime())) continue;

    if (!(await userWantsMarketingEmail(userId))) continue;
    if (await hasActiveEmailFunnelEnrollment(emailNorm, "win_back_3"))
      continue;

    const [recentEnrollment] = await db
      .select({ id: emailFunnelEnrollmentTable.id })
      .from(emailFunnelEnrollmentTable)
      .where(
        and(
          eq(emailFunnelEnrollmentTable.email, emailNorm),
          eq(emailFunnelEnrollmentTable.funnel, "win_back_3"),
          gte(emailFunnelEnrollmentTable.createdAt, cooldownCutoff),
        ),
      )
      .orderBy(desc(emailFunnelEnrollmentTable.createdAt))
      .limit(1);
    if (recentEnrollment) continue;

    const variant = await getEmailFunnelCouponExperimentVariant(userId, {
      email: emailNorm,
      userId,
    });

    try {
      await enrollWinBackMarketingSeries({
        context: {
          anchorOrderId,
          lastDeliveredAt: lastDelivered.toISOString(),
          source: "win_back_cron",
        },
        email: emailNorm,
        experimentVariant: variant,
        userId,
      });
      enrolled += 1;
    } catch (err) {
      console.error(
        "[processWinBackEnrollments] enroll failed:",
        emailNorm,
        err,
      );
    }
  }

  return { enrolled };
}
