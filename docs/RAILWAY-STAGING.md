<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Railway staging: customer + admin frontends

**First deploy checklist:** After the first successful build, the site may load but show no products/categories until the DB has tables. Copy the **DATABASE_URL** from your Railway service → Variables, then from your machine run: `DATABASE_URL='postgresql://...' bun run db:push` (from the repo root). Then reload the site; nav and data will work.

---

You have two frontends in this repo:

- **Customer frontend** – main app (store, checkout, dashboard) in the repo root.
- **Admin frontend** – separate Next.js app in `admin/`, for orders, products, categories, etc.

Both talk to the **same backend** (the main app’s API routes). Auth and CORS are set up so the admin app can call the main app’s APIs.

---

## One service (customer only)

If you only deploy the **main app**:

1. In Railway, create one service from this repo.
2. **Root directory:** leave empty (or `./`) so the root `package.json` is used.
3. **Build command:** `bun run build` (or `bun install && bun run build`).
4. **Start command:** `bun run start` (runs `next start`).
5. **Port:** set to **3000** when Railway asks (or leave default; Next uses `PORT` if set).

Railway will assign a URL like `https://your-app.up.railway.app`. That’s your **customer frontend**. You won’t have the admin UI unless you add a second service (below).

**Env for main app (staging):**

- `NEXT_PUBLIC_APP_URL` = `https://your-app.up.railway.app` (the same URL Railway gives this service). Also used for links in emails (e.g. password reset).
- `NEXT_PUBLIC_ADMIN_APP_URL` = leave empty if you’re not deploying admin; if you do deploy admin, set it to the admin service URL (see below).
- `NEXT_SERVER_APP_URL` = `http://localhost:PORT` (e.g. `http://localhost:8080`) for server-side fetches only; auth email links use `NEXT_PUBLIC_APP_URL`.
- `DATABASE_URL`, `AUTH_SECRET`, and any other env your app needs.

**Database schema (required):** The app expects tables such as `brand`, `category`, `product`, etc. The **start command** runs `bun run db:push && bun run start` (see `railway.json` and `nixpacks.toml`), so each deploy pushes the Drizzle schema to the DB before starting. If you ever need to run it manually (e.g. before first deploy or from your machine):

```bash
# From repo root, with DATABASE_URL pointing at Railway Postgres
bun run db:push
# or: npx drizzle-kit push
```

Use the same `DATABASE_URL` you set on the Railway service.

**Seeding staging from your machine (schema + categories + admin):** You do **not** run these inside Railway. Run them on your own computer, in the **repo root** (`relivator/`), with env vars set so they talk to your staging app and DB.

**Keeping the DB URL off your machine:** If your device is compromised, any credential on it (in `.env` or in shell history) is at risk. The only way to avoid having the staging DB URL on your machine at all is to **run the seed from somewhere that already has the credential**—e.g. GitHub Actions or Railway itself.

- **GitHub Actions (recommended):** A workflow runs the seed in the cloud; the URL lives only in repo Secrets. In the repo: **Settings → Secrets and variables → Actions** add a secret `DATABASE_URL` with your Railway Postgres URL. Then go to **Actions → "Seed staging (DB schema + categories)" → Run workflow**. The workflow runs `db:push` and `db:seed:staging`; your machine never sees the URL. See `.github/workflows/seed-staging.yml`.
- **Railway:** The credential already lives in Railway Variables. You can run a one-off from your machine with the Railway CLI (`railway run bun run db:push && railway run bun run db:seed:staging`) so the URL is injected by the CLI and not typed—but the process still runs on your device, so a compromised machine could still be snooped. To keep the seed entirely off your device, use the GitHub Actions workflow above.

If you do run seeds locally (with `DATABASE_URL` in `.env` or on the command line), keep `.env` out of git and use a strong DB password; a compromised machine can still expose anything you run or store there.

1. **Get these from Railway**
   - **DATABASE_URL** – In your Railway project, open the **main app** service (or the Postgres service) → **Variables** → copy the value of `DATABASE_URL` (the Postgres connection string).
   - **Main app URL** – Your staging store URL, e.g. `https://forthecult.store`.
   - **ADMIN_EMAILS** – The email you want to use for admin (e.g. `you@forthecult.store`). This must match what you set in Railway’s `ADMIN_EMAILS` for the main app.

2. **Schema (if you haven’t already)**
   ```bash
   cd relivator
   DATABASE_URL='postgresql://user:pass@host:port/railway' bun run db:push
   ```
   Use the exact `DATABASE_URL` you copied. This creates all tables (`user`, `category`, `product`, `brand`, etc.).

3. **Categories (and optional brands/products)**
   These scripts connect **directly** to the DB, so they need `DATABASE_URL`:
   ```bash
   DATABASE_URL='postgresql://...' bun run db:seed-categories
   DATABASE_URL='postgresql://...' bun run db:seed-brands    # optional
   DATABASE_URL='postgresql://...' bun run db:seed           # optional: seed products
   ```
   Or in one go: `DATABASE_URL='postgresql://...' bun run db:seed:staging` (categories + brands + **shipping-by-brand** + products + **reviews**). For reviews, staging uses **data/reviews-seed.json** (JSON). Commit that file (generate with `bun run db:extract-reviews` from `data/reviews.csv`). Reviews are seeded even when the product doesn't exist yet (they sync when the product is created).

4. **Admin user**
   Over HTTPS the app hashes the password before storing. For staging you must set `ADMIN_SEED_PASSWORD` in your env (never commit it). It needs the **app URL**, not `DATABASE_URL`:
   ```bash
   ADMIN_EMAILS='you@forthecult.store' \
   NEXT_PUBLIC_APP_URL='https://forthecult.store' \
   ADMIN_SEED_PASSWORD='your-one-time-password' \
   bun run db:seed-admin
   ```
   Replace the email, URL, and password with your values. Use a strong one-time password; after first login, change it in the app. If the user already exists, use "Forgot password?" on the login page.

---

## Two services (customer + admin)

To run both the **store** and the **admin** dashboard:

### Service 1 – Customer frontend (main app)

- **Root directory:** empty (repo root).
- **Build:** `bun run build`
- **Start:** `bun run start`
- **Port:** **3000** (or leave Railway’s default; Next uses `PORT`).
- **Env:**
  - `NEXT_PUBLIC_APP_URL` = main app’s Railway URL (e.g. `https://relivator-staging.up.railway.app`).
  - `NEXT_PUBLIC_ADMIN_APP_URL` = admin app’s Railway URL (e.g. `https://relivator-admin-staging.up.railway.app`).
  - Plus `DATABASE_URL`, `AUTH_SECRET`, etc.

### Service 2 – Admin frontend

- **Root directory:** Depends on your repo layout.
  - If your **repo root** is the **relivator** folder (i.e. the repo contains `admin/`, `src/`, `package.json` at top level), use **`admin`**.
  - If your **repo root** is the **parent** of `relivator` (e.g. repo contains `relivator/admin/`, `relivator/package.json`), use **`relivator/admin`**. Using `admin` here would point at the wrong path (there is no `admin` at repo root), the build may use the wrong app or fail, and routes like `/payment-methods` can 404.
  - In both cases, the value must point at the directory that contains `admin/package.json` (the Next.js app with `admin/src/app/(admin)/payment-methods/page.tsx`).
- **Build:** `bun run build` (runs in `admin/`).
- **Start:** `bun run start` (runs `next start` in `admin/`).
- **Port:** leave Railway’s default. Next.js will use the `PORT` Railway sets; you don’t need to pick 3001.
- **Env (in the admin service):**
  - `NEXT_PUBLIC_MAIN_APP_URL` or `NEXT_PUBLIC_APP_URL` = main app URL (same as `NEXT_PUBLIC_APP_URL` above). The admin app uses this to call the main app’s API and for login redirects.
  - **Database / auth:** the admin app talks to the main app’s API (same backend). It does **not** need its own `DATABASE_URL` or `AUTH_SECRET`; it needs the main app’s URL so it can call `/api/auth/*`, `/api/admin/*`, etc. So only set the main app URL (and any env the admin’s own build needs, if any).

**Redeploying admin:** When you change admin-only code (e.g. sidebar in `admin/src/ui/admin-sidebar.tsx`), you must deploy the **admin** service. Redeploying only the main (customer) service will not update the admin. In Railway, open the **admin** service and use “Redeploy” or push to the branch that triggers the admin build. If the admin service uses the same repo and branch as the main app, ensure its **Root directory** is set to **`admin`** so it builds from `admin/`, not the repo root.

**No custom domain:**  
Use the URLs Railway gives you (e.g. `https://xxx.up.railway.app` and `https://yyy.up.railway.app`). Set those in the env vars above; no domain setup required.

---

## Staging won't deploy (troubleshooting)

**Build timeout:** Railway limits build time by plan (Trial &lt; Hobby 20 min &lt; Pro 60 min). If the build times out:

- **Give the build more memory** – In the service **Variables**, add `NODE_OPTIONS` = `--max-old-space-size=4096` (or `6144`). Low memory can cause slow swapping and timeouts.
- **Upgrade plan** – Pro has a 60-minute build limit if you need more time.
- **Speed up the build** – The app uses `next build --webpack`; the main app has many routes and dependencies, so the first build can take several minutes. Cached installs (e.g. Railpack) help on later deploys.

If the **build** succeeds (e.g. Railpack shows green checkmarks) but the staging service never goes live or the deployment never completes:

1. **Config as code** — The repo includes **`railway.json`** in the app root with explicit `buildCommand` and `startCommand`. That applies to any service whose **Root directory** is the repo root. It overrides dashboard settings and avoids "No start command could be found." Push and redeploy after changing that file.
2. **Environment and branch** — In Railway, open the **staging** environment and confirm the service is there. Under **Settings** → **Source**, ensure the correct branch triggers a deploy. Via CLI: `railway up -e staging` (or your staging env name).
3. **Root directory** — Main app: empty or `./`. Admin: `admin` (or `relivator/admin` if repo root is above relivator). A wrong root can make the build succeed but the start command run the wrong app or fail.
4. **Deploy phase** — In **Deployments**, open the latest deployment. If the build finished but it's not "Active", check the deploy phase and runtime logs (missing start command, crash on boot from missing `DATABASE_URL`/`AUTH_SECRET`, or health check failure).
5. **Required env** — Staging must have: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`. Without `DATABASE_URL`, the app can crash when it touches the DB.

---

## Summary

| What you want        | Services | Main app port | Admin app port |
|----------------------|----------|----------------|----------------|
| Store only           | 1        | 3000 (or Railway’s PORT) | – |
| Store + admin        | 2        | 3000 (or Railway’s PORT) | Railway’s PORT (Next uses it automatically) |

Port **3000** is only the “logical” default for the main app; Railway can assign any port and set `PORT`. Next.js uses `PORT` when present, so you don’t need to hardcode it in the start command.

**Running admin locally:** From the `admin/` folder run `PORT=3001 bun run start` (or `PORT=3001 npm run start`) so the admin app listens on 3001 and doesn’t conflict with the main app on 3000.
