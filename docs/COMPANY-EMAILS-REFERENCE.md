<!-- INTERNAL — DO NOT PUBLISH. Contains internal email mapping and code locations. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->

# Company email addresses – where they appear

Use this as a checklist for an overhaul. Emails are split into: **visible on the site**, **used in APIs/responses**, and **env/config**.

---

## 1. Visible on the website (customer-facing)

| Location | Current value | Notes |
|----------|----------------|--------|
| **Product detail – Returns/refunds copy** | `support@forthecult.store` | Hardcoded in `src/app/products/[id]/product-detail-accordion.tsx` (mailto link + visible text). Shown in the accordion “Returns & refunds” / similar. |

The **footer** does **not** show an email; it has a “Contact Us” link to `/contact`. The **contact page** does not display your support email; it only says “our support email” in the PGP section (no address shown).

---

## 2. Used in API responses / error messages (user can see in UI or emails)

| Location | Current value | Notes |
|----------|----------------|--------|
| **Contact form – where messages are sent** | `CONTACT_TO_EMAIL` env, else `support@forthecult.store` | `src/app/api/contact/route.ts` – recipient of contact form submissions. |
| **Order/checkout error messages** | `support@forthecut.store` | Hardcoded in: `src/app/api/orders/[orderId]/route.ts`, `src/app/api/orders/[orderId]/status/route.ts`, `src/app/api/checkout/orders/[orderId]/route.ts`, `src/app/api/checkout/solana-pay/create-order/route.ts`, `src/app/api/checkout/btcpay/create-order/route.ts`. Shown as “Contact support@…” in error/help text. |
| **Agent capabilities (public API)** | `support@forthecut.store` | `src/app/api/agent/capabilities/route.ts` – exposed in API response. |

---

## 3. Env / config (not visible unless you expose them)

| Env var | Purpose |
|---------|--------|
| `CONTACT_TO_EMAIL` | Recipient for contact form (fallback: `support@forthecult.store`). |
| `RESEND_FROM_EMAIL` | “From” address for Resend (contact, password reset, order shipped). Fallback: `onboarding@resend.dev`. |
| `ADMIN_EMAILS` | Comma-separated admin emails (auth only; not shown on site). |

---

## 4. Inconsistencies to fix in an overhaul

- **Domain mix:** `forthecult.store`, `culturestore.com`, `forthecult.store` all appear.
- **Product UI** uses `support@forthecult.store` (hardcoded).
- **Contact API** uses `support@forthecult.store` when `CONTACT_TO_EMAIL` is unset.
- **Order/checkout/agent** use `support@forthecut.store` (hardcoded).

Recommendation: pick one canonical support address (and domain), then:

1. **Single source of truth:** e.g. env `NEXT_PUBLIC_SUPPORT_EMAIL` or `SUPPORT_EMAIL` (and use it wherever you need to show or reference support email).
2. **Product accordion:** replace hardcoded `support@forthecult.store` with that config.
3. **Contact API:** keep `CONTACT_TO_EMAIL` for *where* form submissions go; can match support email or be a separate inbox.
4. **Order/checkout/agent:** replace all `support@forthecut.store` strings with the same config (or a shared constant that reads from env).
