/**
 * Admin-only metadata for email settings UI: funnels, steps, and transactional kinds.
 * Copy still lives in `notification-templates.ts` and drip builders in `process-email-funnels.ts`.
 */

import { NOTIFICATION_CLASSIFICATION } from "~/lib/notification-templates";

export interface AdminEmailFunnelStep {
  /** `EmailSendKind` value used by `sendEmail` / preview. */
  kind: string;
  label: string;
}

export interface AdminEmailFunnel {
  description: string;
  id: string;
  name: string;
  steps: readonly AdminEmailFunnelStep[];
}

export const ADMIN_EMAIL_FUNNELS: readonly AdminEmailFunnel[] = [
  {
    description:
      "Triggered after signup welcome send; follow-ups at +24h and +72h from enrollment.",
    id: "welcome_3",
    name: "Welcome series",
    steps: [
      { kind: "welcome_email", label: "Immediate welcome (signup)" },
      { kind: "welcome_series_2", label: "Drip step 2 — trending picks" },
      { kind: "welcome_series_3", label: "Drip step 3 — thank-you / membership" },
    ],
  },
  {
    description:
      "Enrolled from idle server cart snapshots (`/api/cron/email-funnels`); three nudges.",
    id: "abandon_cart_3",
    name: "Abandon cart",
    steps: [
      { kind: "abandon_cart_series", label: "Drip step 1 — cart reminder" },
      { kind: "abandon_cart_series_2", label: "Drip step 2 — still interested" },
      { kind: "abandon_cart_series_3", label: "Drip step 3 — last nudge" },
    ],
  },
  {
    description:
      "Started after carrier-confirmed delivery (`review_3` enrollment).",
    id: "review_3",
    name: "Post-delivery review",
    steps: [
      { kind: "order_review_request", label: "Drip step 1 — review ask" },
      { kind: "order_review_series_2", label: "Drip step 2 — social proof" },
      { kind: "order_review_series_3", label: "Drip step 3 — perk / thanks" },
    ],
  },
  {
    description:
      "Lapsed buyers with old delivered orders and no newer paid activity (`win_back_3` enrollment).",
    id: "win_back_3",
    name: "Win-back",
    steps: [
      { kind: "win_back_series", label: "Drip step 1 — we missed you" },
      { kind: "win_back_series_2", label: "Drip step 2 — membership angle" },
      { kind: "win_back_series_3", label: "Drip step 3 — soft close" },
    ],
  },
] as const;

/** Transactional template kinds (from notification classification + auth flows). */
export const ADMIN_TRANSACTIONAL_EMAIL_KINDS: readonly {
  kind: string;
  label: string;
  /** When true, preview is richer if `orderId` is passed to send-preview. */
  prefersOrderId?: boolean;
}[] = [
  ...NOTIFICATION_CLASSIFICATION.transactional.map((id) => ({
    kind: id,
    label: humanizeKind(id),
    prefersOrderId: id.startsWith("order_"),
  })),
  { kind: "password_reset", label: "Password reset link" },
  { kind: "otp", label: "Email OTP / verification code" },
  { kind: "add_email_verification", label: "Add-email verification" },
  { kind: "esim_activation", label: "eSIM activation" },
  { kind: "newsletter_confirm", label: "Newsletter double opt-in confirm" },
];

/** Staff-only — shown in admin catalog but labeled internal. */
export const ADMIN_INTERNAL_EMAIL_KINDS: readonly { kind: string; label: string }[] =
  [
    { kind: "internal_staff_contact", label: "Staff digest — contact form" },
    { kind: "internal_staff_refund_alert", label: "Staff digest — refund alert" },
  ];

/** Optional marketing sends not tied to the four core funnels above. */
export const ADMIN_MARKETING_EXTRA_KINDS: readonly { kind: string; label: string }[] =
  [{ kind: "newsletter_welcome_discount", label: "Newsletter welcome discount" }];

function humanizeKind(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Flat set of every kind the preview endpoint supports. */
export function getAdminPreviewableEmailKinds(): Set<string> {
  const s = new Set<string>();
  for (const f of ADMIN_EMAIL_FUNNELS) {
    for (const step of f.steps) s.add(step.kind);
  }
  for (const r of ADMIN_TRANSACTIONAL_EMAIL_KINDS) s.add(r.kind);
  for (const r of ADMIN_INTERNAL_EMAIL_KINDS) s.add(r.kind);
  for (const r of ADMIN_MARKETING_EXTRA_KINDS) s.add(r.kind);
  return s;
}
