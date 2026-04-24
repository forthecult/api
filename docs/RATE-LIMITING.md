<!-- INTERNAL — DO NOT PUBLISH. Contains rate limit implementation details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->

# Rate limiting

Rate limits are applied to checkout, contact, refund, auth, Loqate, **order status polling**, and **admin API** to reduce abuse and protect quotas.

## Backend: in-memory vs Redis

- **Default:** In-memory store (per Node process). Limits are per-instance; with multiple instances each has its own count.
- **Production (optional):** When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, the app uses [Upstash Redis](https://upstash.com) for rate limiting. Limits are then shared across all instances.

Set both env vars in production if you run multiple instances (e.g. Vercel, Railway) and want consistent limits.

### Staging (`NODE_ENV=production` without Upstash)

Boot calls `assertRateLimitStoreConfigured()` in `instrumentation.ts`. If Upstash is unset, the server throws unless you explicitly allow in-memory limits:

- Set `RATE_LIMIT_ALLOW_IN_MEMORY=true` on **single-instance** staging only. You will see a console warning at boot.
- Prefer adding **Upstash** and `TRUSTED_PROXY_HEADER` (e.g. `cf-connecting-ip` or `fly-client-ip`) so limits match production behavior.

## Presets (generous to avoid blocking normal use)

| Preset        | Limit      | Window | Used for                          |
|---------------|------------|--------|-----------------------------------|
| `orderStatus` | 120 req    | 1 min  | `GET /api/orders/[orderId]/status` (polling) |
| `admin`       | 200 req    | 1 min  | All `/api/admin/*` (per IP)       |
| `checkout`    | 5 req      | 1 min  | Checkout and payment create/confirm |
| `contact`     | 5 req      | 1 min  | Contact form, refund request      |
| `auth`        | 180 req    | 1 min  | Auth/session endpoints            |
| `loqate`      | 30 req     | 1 min  | Address lookup                    |

## Admin routes and 429

When admin rate limit is exceeded, `getAdminAuth()` returns `{ ok: false, response }` with a 429 response. Use the helper so the route returns that response:

```ts
import { adminAuthFailureResponse, getAdminAuth } from "~/lib/admin-api-auth";

// ...
const authResult = await getAdminAuth(request);
if (!authResult?.ok) return adminAuthFailureResponse(authResult);
```

If a route still uses `return NextResponse.json({ error: "Unauthorized" }, { status: 401 })` when `!authResult?.ok`, the client will get 401 instead of 429 when rate limited; the limit is still enforced. Prefer `adminAuthFailureResponse(authResult)` so clients see 429 with `Retry-After`.
