import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

/**
 * Outbound email attempts and lifecycle updates (merged with webhook events by resendId).
 * RLS enabled in production Postgres; app uses service role / DB URL that bypasses RLS.
 */
export const emailEventTable = pgTable(
  "email_event",
  {
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    resendId: text("resend_id"),
    status: text("status").notNull(),
    subject: text("subject"),
    toEmail: text("to_email").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("email_event_to_email_created_at_idx").on(t.toEmail, t.createdAt),
    index("email_event_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("email_event_resend_id_idx").on(t.resendId),
  ],
);

/**
 * Suppression list (bounce, complaint, unsubscribe). Email sends consult this before Resend.
 */
export const emailSuppressionTable = pgTable("email_suppression", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").primaryKey(),
  notes: text("notes"),
  reason: text("reason").notNull(),
  source: text("source"),
});

/**
 * Newsletter subscribers with double opt-in. Confirmed rows may have Resend contact id.
 */
export const newsletterSubscriberTable = pgTable("newsletter_subscriber", {
  confirmationTokenHash: text("confirmation_token_hash"),
  consentedAt: timestamp("consented_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").primaryKey(),
  ipAtSignup: text("ip_at_signup"),
  resendContactId: text("resend_contact_id"),
  source: text("source"),
  status: text("status").notNull().default("pending"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  userAgentAtSignup: text("user_agent_at_signup"),
});

/**
 * Multi-step marketing funnels (welcome, abandon cart, post-delivery review, win-back).
 * Cron advances `last_step_sent` and schedules `next_send_at`. A/B variant from PostHog is stored for analysis.
 */
export const emailFunnelEnrollmentTable = pgTable(
  "email_funnel_enrollment",
  {
    completed: boolean("completed").notNull().default(false),
    context: jsonb("context").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    email: text("email").notNull(),
    experimentVariant: text("experiment_variant"),
    funnel: text("funnel").notNull(),
    id: text("id").primaryKey(),
    lastStepSent: integer("last_step_sent").notNull().default(0),
    nextSendAt: timestamp("next_send_at").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("email_funnel_enrollment_next_send_idx").on(
      t.nextSendAt,
      t.completed,
    ),
    index("email_funnel_enrollment_email_funnel_idx").on(t.email, t.funnel),
  ],
);
