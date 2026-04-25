# Frontend QA Checklist (eCommerce)

Use this checklist for every storefront PR and release.

## Core Engineering Quality

- Run `bun run check` and fix all errors before review.
- Ensure no tiny/unreadable text is introduced on key customer surfaces (product, cart, checkout, auth).
- Keep components accessible: semantic headings, labeled form controls, keyboard focus states.
- Avoid fragile selectors in tests; prefer role-based locators.
- Ensure loading/error/empty states exist for customer-critical components.

## eCommerce Functional QA

- Product discovery: home/category/brand/product pages return 2xx and render primary CTAs.
- Cart flow: add item, open cart, quantity controls, remove item.
- Checkout flow: shipping calc, coupon endpoint, Stripe intent/session endpoints do not 5xx.
- Digital flow: eSIM purchase endpoints do not 5xx on malformed payloads.
- Auth/session flow: `/api/auth/session` or `/api/auth/get-session` never 5xx.

## Security & Privacy

- No secrets in code, logs, or test fixtures.
- Validate auth/session failures degrade gracefully to guest mode when safe.
- Verify rate limits are applied to public abuse-prone endpoints.
- Ensure PII fields are not leaked to browser logs or telemetry accidentally.

## Required Commands

- `bun run check`
- `bun run smoke:core`
- `bun run smoke:extended` (for risky UI/auth/checkout changes)

## CI/Deploy Gates (must stay green)

- `CI (typecheck + build) / check`
- `CI (typecheck + build) / smoke-core`
- `Security Audit / security-check`
- `Snyk PR Security Gate / snyk-security-gate`
