# Admin frontend

Next.js app for the admin dashboard (products, orders, payment methods, etc.). It talks to the main app’s API; see [../docs/RAILWAY-STAGING.md](../docs/RAILWAY-STAGING.md) for deployment.

## Deploy root directory

- **If your repo root is `relivator`** (repo contains `admin/`, `src/`, root `package.json`): use **`admin`**.
- **If your repo root is the parent of `relivator`** (repo contains `relivator/admin/`, `relivator/package.json`): use **`relivator/admin`**.

Using `admin` when the app is actually at `relivator/admin` will build the wrong app or fail; routes like `/payment-methods` will 404.

## Local

```bash
bun install
bun run dev   # http://localhost:3001
```
