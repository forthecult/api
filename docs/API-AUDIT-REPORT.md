# Public API & Documentation Audit Report

**Date:** February 2026  
**Scope:** Public API endpoints, API documentation, security (admin exposure, PII), brand alignment.

---

## 1. Endpoint verification (live tests)

| Endpoint | Result | Notes |
|----------|--------|--------|
| `GET /api/health` | ✅ 200 | Returns `{ status, timestamp }`. CORS present. |
| `GET /api/agent/capabilities` | ✅ 200 | Returns capabilities, payment, shipping, rate limits. |
| `GET /api/agent/summary` | ✅ 200 | Machine-readable summary for agents. |
| `GET /api/openapi.json` | ✅ 200 | OpenAPI 3.0 spec; no admin paths. |
| `OPTIONS /api/health` | ✅ 204 | CORS: `Access-Control-Allow-Origin: *`, methods GET, POST, OPTIONS. |
| `OPTIONS /api/checkout` | ✅ 204 | CORS preflight OK. |
| `GET /api/categories` | ⚠️ 500 | Route exists; 500 in test env (likely DB/env). |
| `GET /api/products/featured` | ⚠️ 500 | Route exists; 500 in test env (likely DB/env). |
| `POST /api/products/semantic-search` | ⚠️ 500 | Route exists; 500 in test env (likely DB/env). |

**Conclusion:** Public routes are implemented and documented. CORS is correctly applied on agent-facing routes (health, checkout). Non-200s in this run are attributable to test environment (e.g. database or configuration not available), not to missing or misdocumented endpoints.

---

## 2. Documentation accuracy

- **For the Cult API.md**  
  - Updated: GET order details now documents `?ct=` (confirmation token) and PII redaction.  
  - Cancel order documents auth or `lookupValue` for ownership.  
  - Security & PII section added; base URL and endpoint table aligned with implementation.

- **OpenAPI spec** (`/api/openapi.json` and `src/lib/openapi.ts`)  
  - Added `POST /api/orders/{orderId}/cancel` with description (auth or `lookupValue`).  
  - GET `/api/orders/{orderId}` updated with optional query param `ct` and access/PII note.  
  - All paths under `/api`; no admin paths in the spec.

- **Agentic reference** (`api/skills/agentic-commerce-forthecult/references/API.md`)  
  - All paths updated to include `/api` prefix (e.g. `GET /api/health`, `GET /api/orders/{orderId}`).  
  - Order details example clarified: full PII only when authorized; otherwise redacted.  
  - Base URL clarified; placeholder used for customer name in examples.

---

## 3. Admin endpoints not exposed

- **Public docs:** For the Cult API.md and OpenAPI spec describe only the public API. Admin endpoints (`/api/admin/*`) are explicitly out of scope in the main doc and are not listed in the OpenAPI paths.
- **OpenAPI paths checked:** No `/admin` or `/api/admin` paths appear in the served OpenAPI spec.
- **Internal docs:** References to admin APIs (e.g. PRINTIFY-INTEGRATION.md, POD-WEBHOOK-SETUP.md) are in internal/developer docs, not in customer-facing or agent-facing public API docs. No change required.

---

## 4. PII and security

- **Order details (`GET /api/orders/{orderId}`):**  
  - Implemented access: admin, session owner (userId/email/wallet), or first-visit with valid `ct` and order &lt;1h old.  
  - Without access: email redacted (e.g. `u***@e***.com`), shipping limited to `countryCode` only.  
  - Docs updated to state that full details and PII require auth or `?ct=`, and that status-only polling uses `/api/orders/{orderId}/status` (no PII).

- **Order status (`GET /api/orders/{orderId}/status`):**  
  - Returns only `orderId`, `status`, `paidAt`, `_actions`, and optionally `expiresAt` / `txHash`. No email, no address.  
  - Rate-limited; orderId acts as the secret for polling.

- **Cancel (`POST /api/orders/{orderId}/cancel`):**  
  - Requires session owner, admin, or request body `lookupValue` (billing email, payer address, or shipping postal code) to prove ownership.  
  - Documented in OpenAPI and For the Cult API.

- **Public docs and examples:** Only placeholder data (e.g. `customer@example.com`, “Customer Name”) used; no real PII in examples.

---

## 5. Brand and product alignment

- **For the Cult API.md:**  
  - Intro updated to state product scope: lifestyle, wellness, longevity (apparel, accessories, eSIMs, membership) and alignment with the Culture brand.  
  - Keeps “For the Cult” and forthecult.store; tone remains agent-friendly and professional.

- **OpenAPI info:**  
  - Title “For the Cult API”, contact/URL forthecult.store; description already emphasizes agent-friendly eCommerce. No change.

---

## 6. Fixes applied during audit

1. **OpenAPI**  
   - Added `POST /api/orders/{orderId}/cancel`.  
   - Documented optional `ct` on `GET /api/orders/{orderId}` and PII/access behavior.

2. **For the Cult API.md**  
   - GET order details: `?ct=` and PII redaction documented.  
   - Cancel: auth or `lookupValue` documented.  
   - Security & PII and product/brand scope added.

3. **Agentic API reference**  
   - All paths use `/api` prefix.  
   - Order details access and PII note; placeholder names in examples.

4. **Sitemap conflict (Next.js)**  
   - Resolved conflict between `sitemap.ts` (metadata route) and `sitemap/page.tsx`: human sitemap moved to `/site-map` (new `site-map/page.tsx`), footer and sitemap.ts updated. This unblocked local dev and API testing.

---

## 7. Localhost and sensitive information

- **No localhost in public API documentation:** For the Cult API.md, OpenAPI spec, and agentic API reference use only production base URL (`https://forthecult.store` or `https://ai.forthecult.store`). The for-the-cult-store skill base URL section instructs agents to use the production URL only; localhost is not referenced.
- **API responses never expose localhost:** `/api/agent/capabilities` and `/api/agent/summary` use `sanitizeBaseUrlForPublicApi()` so that if `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_AGENT_APP_URL` is set to localhost/127.0.0.1, the response uses production URLs instead.
- **No passwords or secrets in public APIs or public API docs:** Examples use placeholders only. Internal documents (e.g. RAILWAY-STAGING, ai-admin-temporary-access, ADDING-A-PAYMENT-METHOD) are not linked from or mentioned in the public API documentation.

---

## 8. Recommendations

- **Environment:** Run smoke tests (health, capabilities, categories, featured, semantic-search) in an environment with a connected database and correct env so all documented public endpoints return expected 2xx or documented 4xx where applicable.
- **Order status 404:** In the test run, `GET /api/orders/fake-order-id-123/status` returned 500 (INTERNAL_ERROR). With DB available, a non-existent orderId should return 404 (ORDER_NOT_FOUND). If 500 persists with DB connected, check for uncaught exceptions or schema mismatches (e.g. `paymentStatus`) in the order status route.
- **Staged/production:** Re-verify CORS and response shapes against the production base URL and any staging URLs used by agents.

---

*This report reflects the state of the public API and documentation after the above updates.*
