# Email templates (order emails, etc.)

Transactional emails (order confirmation, order shipped, password reset, etc.) can use a **shared layout** (header, content, footer) so every email looks consistent and links back to your site.

---

## Option 1: In-code layout (current setup)

We use a shared layout built in code so you don’t depend on Resend’s UI.

- **Where:** `src/lib/email-layout.ts`
- **What it does:** `buildEmailHtml(contentHtml, options)` returns full HTML with:
  - **Header:** Site name (or logo if you pass `logoUrl`)
  - **Content:** Your email body (HTML)
  - **Footer:** Copyright + support line
  - **Optional CTA:** Button (e.g. “View order”) when you pass `ctaUrl` and `ctaLabel`

**Used by:** Order confirmation and order shipped emails (they pass plain-text body through `plainTextToHtml()` then wrap with `buildEmailHtml()`).

**Customize:**

- **Site name:** Pass `siteName` in options, or change `DEFAULT_SITE_NAME` in `email-layout.ts`.
- **Logo:** Set `logoUrl` to a full URL (e.g. your CDN or UploadThing). No logo by default.
- **Footer:** Pass `footerLine1` and `footerLine2` in options, or edit the defaults in `email-layout.ts`.

To use the layout in another email (e.g. refund, welcome):

```ts
import { buildEmailHtml, plainTextToHtml } from "~/lib/email-layout";

const contentHtml = plainTextToHtml("Your message here.");
const html = buildEmailHtml(contentHtml, {
  ctaUrl: "https://yoursite.com/dashboard",
  ctaLabel: "Go to dashboard",
});
await resend.emails.send({ from, to, subject, html, text: "..." });
```

---

## Option 2: Resend dashboard templates

Resend has **Templates** in the dashboard so you can design and edit emails without deploying code.

- **Where:** [resend.com/templates](https://resend.com/templates)
- **How it works:**
  1. Create a template in the Resend UI (header, body, footer, variables).
  2. Use variables (e.g. `{{orderId}}`, `{{customerName}}`) in subject and body.
  3. Publish the template.
  4. Send via API with the template ID and variable values; Resend renders the email.

**Pros:** Non-developers can change copy and layout; version history; test sends from the dashboard.  
**Cons:** You send by template ID + data instead of raw HTML; variables and structure are defined in Resend, not in this repo.

**Sending with a Resend template (when you create one):**

```ts
await resend.emails.send({
  from,
  to,
  subject: "Order confirmed", // or use template subject
  templateId: "your-template-id-from-dashboard",
  templateData: { orderId: "abc123", customerName: "Jane" },
});
```

We don’t use template ID in this repo yet; all transactional emails use the in-code layout (Option 1). You can switch individual emails to Resend templates later by calling the API with `templateId` and `templateData` instead of `html`/`text`.

---

## Copy and subject lines

Subject and body **copy** (e.g. “Order confirmed”, “Thanks for your order…”) still come from:

- **Code:** `src/lib/notification-templates.ts` (default subject/body per type).
- **Admin:** Notification templates in the admin app can override `emailSubject` and `emailBody` per type.

The **layout** (header, footer, CTA button) is what’s shared by `email-layout.ts` (or by a Resend template if you use Option 2).
