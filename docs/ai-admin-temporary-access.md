<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
<!-- Do not include this document or the env var name ADMIN_AI_API_KEY in any public documentation, public API documentation, or external documentation intended for public AI agents or third parties. -->
# Secure Temporary Access for AI to Admin APIs

This guide describes secure ways to give an AI (e.g. Cursor, Claude, or another agent) **temporary** access to your production admin interface/APIs for actions like updating categories (copy + SEO) and adding products.

---

## Current auth (relivator)

Admin APIs accept:

1. **Session** – Cookie for a user whose email is in `ADMIN_EMAILS`.
2. **API key** – `Authorization: Bearer <key>` or `X-API-Key: <key>` where the key matches `ADMIN_API_KEY`.

So an AI can already call admin routes if it has a valid key or session. The goal is to make that access **temporary** and **scoped** so you can revoke it without breaking human admin use.

---

## Recommended approaches (secure + temporary)

### 1. **Separate AI-only key with manual rotation (simplest)**

- **Do not** give the AI your main `ADMIN_API_KEY` (used by you or scripts).
- Add a **second** key used only for the AI:
  - In relivator: support `ADMIN_AI_API_KEY` in addition to `ADMIN_API_KEY` (same auth logic, different env var).
  - Set `ADMIN_AI_API_KEY` to a long random value (e.g. `openssl rand -hex 32`).
- **Where the AI gets it:** Put it in a **Cursor rule** or **project `.env`** (gitignored). Do **not** paste it into normal chat or commit it.
- **Temporary:** When the task is done (or at end of day), rotate the key: generate a new value, set it in production env and in the rule/env the AI uses. Old key stops working immediately.
- **Revocation:** Remove or change `ADMIN_AI_API_KEY` in production; AI loses access; human admin (session or `ADMIN_API_KEY`) unchanged.

**Pros:** Minimal code change; clear separation; easy to revoke.  
**Cons:** Key is still valid until you rotate it; no built-in expiry.

---

### 2. **Short-lived JWT for the AI (recommended for "session-like" access)**

- You generate a **JWT** with short expiry (e.g. 1–4 hours) and optional scope (e.g. `["categories", "products"]`).
- The AI uses that JWT as `Authorization: Bearer <jwt>`.
- Backend validates JWT (signature + expiry) and optionally restricts by scope (e.g. only allow `/api/admin/categories/*` and `/api/admin/products/*`).

**Flow:**

1. You run a small script or use an admin "Issue AI token" action (e.g. "Valid 2 hours, scope: categories, products").
2. Script/output gives you a JWT. You paste it into a Cursor rule or env (e.g. `ADMIN_AI_TOKEN=eyJ...`) so the agent can read it.
3. The agent sends `Authorization: Bearer <ADMIN_AI_TOKEN>` on every admin request.
4. After 2 hours the JWT expires; no rotation of a long-lived key needed.

**Implementation outline:**

- Env: `ADMIN_AI_JWT_SECRET` (server-only).
- Token payload: `{ sub: "ai-agent", scope: ["categories", "products"], exp, iat }`.
- In `getAdminAuth()` (or a wrapper): if `Authorization: Bearer <token>` is present and looks like a JWT (e.g. three base64 parts), verify with `ADMIN_AI_JWT_SECRET` and `exp`; if valid, return `{ ok: true, method: "ai_jwt", scope }`. Then in middleware or per-route, allow only paths that match `scope` (e.g. categories + products only).

**Pros:** Truly temporary; can scope to categories + products; no key rotation.  
**Cons:** Requires implementing JWT issue + validation and scope checks.

---

### 3. **Human-in-the-loop (no direct prod credentials)**

- The AI **never** gets prod admin credentials.
- The AI produces **artefacts** you run or apply yourself:
  - **Option A:** Scripts (e.g. `curl` or a small Node script) that **you** run locally with your own `ADMIN_API_KEY` or session.
  - **Option B:** Structured "change request" (e.g. JSON or markdown) that you paste into an admin "Apply AI changes" page; the page uses **your** session to perform the updates.

**Pros:** Highest security; no credential in AI context.  
**Cons:** Less autonomous; you must run scripts or click "Apply" for each batch.

---

## What to avoid

- **Don't** put an admin API key in normal chat, docs that get committed, or public rules.
- **Don't** use the same key for humans and AI if you want to revoke AI access without affecting yourself.
- **Don't** grant broader scope than needed (e.g. avoid giving refunds/orders access if the AI only does categories + products).

---

## Summary

| Approach              | Temporary? | Scoped? | Effort   | Best for                          |
|-----------------------|-----------|--------|----------|-----------------------------------|
| Separate AI key       | Manual    | No     | Low      | Quick setup, manual rotation      |
| Short-lived JWT       | Yes       | Yes    | Medium   | Session-like, categories + products |
| Human-in-the-loop     | N/A       | By design | Low   | Maximum safety, no AI credentials  |

For **quick and secure**: use a **separate `ADMIN_AI_API_KEY`** and rotate it when you're done.  
For **temporary and scoped**: add **short-lived JWT** with scope limited to categories and products.

If you want, the next step can be implementing option 1 (support `ADMIN_AI_API_KEY` in relivator) and/or option 2 (JWT issue + validation + scope in admin auth).
