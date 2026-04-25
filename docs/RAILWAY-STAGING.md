# Railway — staging / production notes (webapp + admin)

## Services

- **Storefront (`webapp/`)** — main Next.js app; owns `/api/*`, auth, Resend sends, webhooks (`/api/webhooks/resend`), PostHog proxy (`/api/ingest/*`).
- **Admin (`webapp/admin/`)** — separate Next deploy; rewrites `/api/*` to the storefront URL (`NEXT_PUBLIC_MAIN_APP_URL` / `NEXT_PUBLIC_APP_URL`). See [admin/README.md](../admin/README.md).

## Required env (storefront)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | **Storefront origin** (e.g. `https://forthecult.store`) — must match the URL users open; Better Auth rejects `Origin` if it is not trusted (see `auth-trusted-origins.ts`). Railway also injects `RAILWAY_PUBLIC_DOMAIN` (`*.up.railway.app`), which is trusted automatically when set. |
| `DATABASE_URL` | Postgres (Drizzle) |
| `RESEND_API_KEY` | Send email |
| `RESEND_FROM_EMAIL` | Verified sender (`Name <noreply@domain>`) |
| `RESEND_WEBHOOK_SECRET` | Svix secret for `/api/webhooks/resend` |
| `EMAIL_UNSUBSCRIBE_SECRET` | HMAC for unsubscribe tokens (min 16 chars) |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional analytics |
| `POSTHOG_HOST` | Ingest API for **server** (`https://us.i.posthog.com` or EU equivalent) |
| `POSTHOG_SERVER_KEY` | Same project key as `NEXT_PUBLIC_POSTHOG_KEY` for server captures |
| `RESEND_NEWSLETTER_SEGMENT_ID` | Optional; Resend marketing segment for newsletter contacts |

Optional:

- `EMAIL_UNSUBSCRIBE_MAILTO` — default `mailto:` for `List-Unsubscribe`
- `NEWSLETTER_WELCOME_DISCOUNT_CODE` — code in welcome email after double opt-in
- `NEXT_PUBLIC_POSTHOG_HOST` — override if not using same-origin `/ingest`

**Rate limiting (avoids boot `unhandledRejection` on staging):**

| Variable | When |
|----------|------|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Recommended — same as prod for shared limits |
| `RATE_LIMIT_ALLOW_IN_MEMORY=true` | Only if staging runs `NODE_ENV=production` without Upstash **and** a single instance |
| `TRUSTED_PROXY_HEADER` | Set to `cf-connecting-ip`, `fly-client-ip`, or another header your edge sets (see `TRUSTED_PROXY_HEADERS` in `webapp/src/lib/rate-limit.ts`) — fixes “rate limits are not per-client-ip” warnings |

### Server Actions: “Failed to find Server Action” (after deploy)

Next.js encrypts Server Action payloads. If each build uses a **new** secret, tabs that still have **old JS** from the previous deploy call actions the new server cannot decode — you see [Failed to find Server Action](https://nextjs.org/docs/messages/failed-to-find-server-action). Mitigations:

1. **Stable key (recommended for self‑hosted / Railway)** — set a fixed secret at **build time** and runtime (same value on every deploy):

   ```bash
   openssl rand -base64 32
   ```

   Add to Railway (or CI) as **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** (see Next.js docs for length: use a 32‑byte AES key as base64). Rebuild after setting.

2. **Same artifact everywhere** — one image/build per release on all replicas (avoid per‑machine `next build` with different keys).

3. **User impact** — a hard refresh usually clears it; skew is worst in the minutes after a deploy.

`ECONNRESET` / `aborted` around the same time is often the client closing the tab or the proxy resetting the connection; it is not the same root cause as (1).

## Health

- Railway can HTTP-check the storefront root or `/api/health` if exposed.
- After deploy, confirm **Resend webhook** delivery in the Resend dashboard (test event).

## Migrations

`db:migrate-email` and `db:migrate-rls` use `scripts/run-psql-migration.ts` so `DATABASE_URL` is read from `webapp/.env` and `webapp/.env.local` (plain `psql $DATABASE_URL` in package scripts does not load those files).

From a machine that can reach the database (local Postgres, tunnel, or Railway’s `DATABASE_URL`):

```bash
cd webapp
bun run db:push
bun run db:migrate-email-foundation   # migrate-email-tables.sql + migrate-enable-rls-auth-tables.sql
```

If you use raw SQL only: `bun run db:migrate-email` then `bun run db:migrate-rls` (or the combined `db:migrate-email-foundation`).

## Setting env vars on Railway

1. [Create an API token](https://railway.app/account/tokens) and add **`RAILWAY_API_TOKEN`** to your shell or Cursor so the Railway MCP / CLI can act on your account.
2. In the [Railway dashboard](https://railway.app) → your **storefront** service → **Variables**, set every row from [`.env.example`](../.env.example) that applies (at minimum: `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET` (≥16 chars), `POSTHOG_HOST`, `POSTHOG_SERVER_KEY` if you use PostHog). Values are the same in staging and production except domains and keys should match each environment.
3. Redeploy after changing variables. Configure the Resend **webhook** URL to `https://<your-storefront-host>/api/webhooks/resend` and paste **`RESEND_WEBHOOK_SECRET`** from Resend into Railway.

## Cron

- Creator-fee cron: `GET /api/cron/distribute-creator-fees` with `Authorization: Bearer $CRON_SECRET` (see `vercel.json` / Railway cron scheduler).
