# Email templates

## Architecture

1. **React Email** — Components live in [`src/emails/`](../src/emails/). They render to HTML + plain text via `@react-email/render`.
2. **`sendEmail` wrapper** — [`src/lib/email/send-email.ts`](../src/lib/email/send-email.ts): consent, suppression, `email_event` logging, idempotent Resend sends, `List-Unsubscribe` headers, PostHog `email_sent`.
3. **Copy defaults** — [`src/lib/notification-templates.ts`](../src/lib/notification-templates.ts) holds subject/body defaults and transactional vs marketing classification.

## Transactional vs marketing

- **Transactional** — Order lifecycle, refunds, support, auth-critical paths. Respects `transactionalEmail` (except auth bypass kinds: OTP, password reset, add-email verification, newsletter confirm, internal staff).
- **Marketing** — Welcome signup, newsletter welcome/discount. Respects `marketingEmail` + unsubscribe suppression.

## Admin

- **Notifications** page — tabs for template copy, recent `email_event` rows, suppression list, and **Test send** (calls `/api/admin/email/test-send`).

## DNS & deliverability

See [EMAIL-DELIVERABILITY.md](./EMAIL-DELIVERABILITY.md).

## Option: Resend dashboard templates

You can still use Resend-hosted templates for one-off campaigns; the codebase defaults to React Email for versioned, reviewable markup.
