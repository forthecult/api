import type { NotificationType } from "~/lib/notification-templates";

import { NOTIFICATION_CLASSIFICATION } from "~/lib/notification-templates";

const MARKETING_KINDS = new Set<string>([
  ...NOTIFICATION_CLASSIFICATION.marketing,
  "newsletter_welcome_discount",
]);

export type EmailSendKind = ExtraEmailSendKind | NotificationType;

/** Kinds not in `NotificationType` but sent through the email wrapper. */
export type ExtraEmailSendKind =
  | "add_email_verification"
  | "esim_activation"
  | "internal_staff_contact"
  | "internal_staff_refund_alert"
  | "newsletter_confirm"
  | "newsletter_welcome_discount"
  | "otp";

const CONSENT_BYPASS_KINDS = new Set<string>([
  "add_email_verification",
  "internal_staff_contact",
  "internal_staff_refund_alert",
  "newsletter_confirm",
  "otp",
  "password_reset",
]);

/** Treated as transactional for preference + suppression rules (not marketing). */
const TRANSACTIONAL_EXTRA_KINDS = new Set<string>([
  "esim_activation",
  "internal_staff_contact",
  "internal_staff_refund_alert",
]);

export function bypassesConsentGate(kind: EmailSendKind): boolean {
  return CONSENT_BYPASS_KINDS.has(kind);
}

export function isMarketingEmailKind(kind: EmailSendKind): boolean {
  return MARKETING_KINDS.has(kind);
}

export function isTransactionalEmailKind(kind: EmailSendKind): boolean {
  if (bypassesConsentGate(kind)) return true;
  if (isMarketingEmailKind(kind)) return false;
  if (TRANSACTIONAL_EXTRA_KINDS.has(kind)) return true;
  return NOTIFICATION_CLASSIFICATION.transactional.includes(
    kind as (typeof NOTIFICATION_CLASSIFICATION.transactional)[number],
  );
}
