# Security — customer surfaces

> Scope: what can and cannot appear in customer-facing experiences. For the operator runbook (admin routes, API keys, auth mechanics), see [`../../SECURITY.md`](../../SECURITY.md). For the source-code rule that backs this doc, see [`../../.cursor/rules/no-sensitive-auth-in-public-docs.mdc`](../../.cursor/rules/no-sensitive-auth-in-public-docs.mdc).

These rules apply to **customer-facing** experiences: storefront UI, signed-in **dashboard** pages, **API JSON** returned to browsers, **toast and inline error messages**, and any **vendor-facing** or **public** documentation we ship or host.

Internal-only runbooks under `docs/` that are clearly **operator/engineering** references may name environment variables; still avoid copying real secret values into files.

## Environment variables and deployment configuration

- **Never** show environment variable **names** (e.g. `NEXT_PUBLIC_*`, `VERCEL_URL`, `DATABASE_URL`, `*_SECRET`, `*_API_KEY`) in:
  - Customer or dashboard **UI copy**
  - **User-visible** API error or warning strings
  - **Toast** messages
  - **Public** marketing pages, help articles, or README sections aimed at merchants
- **Never** instruct customers to “set” a specific env var or name a **hosting provider** as the fix (e.g. “set `VERCEL_URL`”). Use **support** or generic “configuration” language instead.
- **Prefer** generic messages: “Something went wrong,” “try again later,” “contact support,” or “this integration isn’t available right now.”
- **Operators** fix configuration in deployment tooling or internal docs—not in product copy.

## API responses consumed by the browser

- Return **stable, generic** `error` / `message` fields for validation and failure cases.
- Reserve **detailed** reasons (including env-related hints) for **server logs** and **internal** dashboards—not for JSON sent to clients.
- In **development only**, optional extra detail may be gated behind `NODE_ENV === "development"` **server-side**; do not expose secret names in production responses.

## UI copy (including `/chat` and dashboard)

- Do not mention **internal code paths**, **module names**, or **env keys** in help text. Describe behavior in plain language (“links to private networks are blocked”) without naming implementation.
- If a feature depends on server configuration, the customer message should not reveal **how** it is configured.

## Documentation split

- **Customer-facing** / **vendor** docs: follow the same rules as UI—no env var names, no internal architecture that aids attackers.
- **Internal engineering** docs (`docs/` runbooks, deploy guides): env vars may be listed for **operators**; still avoid storing real secrets in repositories.

## Consistency with other rules

- Align with **`.cursor/rules/no-sensitive-auth-in-public-docs.mdc`** (auth, vendors, secrets in public material).
- This document extends that policy to **all** env-related disclosure and **customer-visible** technical hints.

## Checklist before PR (customer-touching changes)

- [ ] No new env var names in user-visible strings or API responses to browsers.
- [ ] Errors and warnings are generic enough for end users; details go to logs.
- [ ] Dashboard and chat copy reviewed for deployment/implementation leakage.
