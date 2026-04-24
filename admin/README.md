# Admin frontend

Next.js app for the admin dashboard (products, orders, payment methods, etc.). It talks to the main app’s API; see [../docs/RAILWAY-STAGING.md](../docs/RAILWAY-STAGING.md) for deployment.

## Sessions vs the storefront (default)

- **Auth client** uses the **admin origin** (`getAuthClientBaseUrl`) so Better Auth session cookies are set for the admin host, not the public store.
- **API calls** default to **same-origin** (`getAdminApiBaseUrl` returns `""`). `next.config.ts` **rewrites** `/api/*` to `NEXT_PUBLIC_MAIN_APP_URL` / `NEXT_PUBLIC_APP_URL`, so the browser never sends admin cookies to the storefront origin.
- **Links / sign-in redirect** still use the storefront URL from `getMainAppUrl` (meta `culture-storefront-origin` + env).

**Legacy cross-origin API + shared session cookie:** set on the **admin** service `NEXT_PUBLIC_ADMIN_API_RELATIVE=0`, and on the **main** app set `AUTH_SHARE_SESSION_COOKIE_WITH_ADMIN=true` (and only then consider `AUTH_COOKIE_DOMAIN` / `sameSite: none`). That path is weaker for CSRF; prefer the default above.

## Deploy root directory

- **If your repo root is `webapp/`** (repo contains `admin/`, `src/`, root `package.json`): use **`admin`**.
- **If your repo root is the parent of `webapp/`** (repo contains `webapp/admin/`, `webapp/package.json`): use **`webapp/admin`**.

Using `admin` when the app is actually at `webapp/admin` will build the wrong app or fail; routes like `/payment-methods` will 404.

## Local

```bash
bun install
bun run dev   # http://localhost:3001
```
