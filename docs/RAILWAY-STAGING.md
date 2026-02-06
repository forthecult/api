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

**Database schema (required):** The app expects tables such as `brand`, `category`, `product`, etc. If you see errors like `relation "brand" does not exist` (PostgreSQL 42P01), run migrations against the **staging** `DATABASE_URL` from your machine (or a one-off deploy step), for example:

```bash
# From repo root, with DATABASE_URL pointing at Railway Postgres
bun run db:push
# or: npx drizzle-kit push
```

Use the same `DATABASE_URL` you set on the Railway service. After the schema exists, build and runtime will succeed.

**Seeding staging from your machine (schema + categories + admin):** You do **not** run these inside Railway. Run them on your own computer, in the **repo root** (`relivator/`), with env vars set so they talk to your staging app and DB.

**Keeping the DB URL off your machine:** Your `.env` is gitignored, so the staging `DATABASE_URL` there is never committed—but it still lives in a file. To avoid storing it at all: **don’t put the staging `DATABASE_URL` in `.env`**. Copy it from Railway when you need it and pass it only on the command line (e.g. `DATABASE_URL='postgresql://...' bun run db:push`). The value will be in your shell history unless you prefix the command with a space (if your shell is configured to ignore those) or clear history. Use a separate `.env.local` or similar only for local dev, and keep the staging URL only in Railway’s Variables.

1. **Get these from Railway**
   - **DATABASE_URL** – In your Railway project, open the **main app** service (or the Postgres service) → **Variables** → copy the value of `DATABASE_URL` (the Postgres connection string).
   - **Main app URL** – Your staging store URL, e.g. `https://bythecult-production.up.railway.app`.
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
   Or in one go: `DATABASE_URL='postgresql://...' bun run db:seed:staging` (categories + brands + products).

4. **Admin user**
   Over HTTPS the app hashes the password before storing. For staging you must set `ADMIN_SEED_PASSWORD` in your env (never commit it). It needs the **app URL**, not `DATABASE_URL`:
   ```bash
   ADMIN_EMAILS='you@forthecult.store' \
   NEXT_PUBLIC_APP_URL='https://bythecult-production.up.railway.app' \
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

- **Root directory:** **`admin`** (so Railway uses `admin/package.json`).
- **Build:** `bun run build` (runs in `admin/`).
- **Start:** `bun run start` (runs `next start` in `admin/`).
- **Port:** leave Railway’s default. Next.js will use the `PORT` Railway sets; you don’t need to pick 3001.
- **Env (in the admin service):**
  - `NEXT_PUBLIC_MAIN_APP_URL` or `NEXT_PUBLIC_APP_URL` = main app URL (same as `NEXT_PUBLIC_APP_URL` above). The admin app uses this to call the main app’s API and for login redirects.
  - **Database / auth:** the admin app talks to the main app’s API (same backend). It does **not** need its own `DATABASE_URL` or `AUTH_SECRET`; it needs the main app’s URL so it can call `/api/auth/*`, `/api/admin/*`, etc. So only set the main app URL (and any env the admin’s own build needs, if any).

**No custom domain:**  
Use the URLs Railway gives you (e.g. `https://xxx.up.railway.app` and `https://yyy.up.railway.app`). Set those in the env vars above; no domain setup required.

---

## Summary

| What you want        | Services | Main app port | Admin app port |
|----------------------|----------|----------------|----------------|
| Store only           | 1        | 3000 (or Railway’s PORT) | – |
| Store + admin        | 2        | 3000 (or Railway’s PORT) | Railway’s PORT (Next uses it automatically) |

Port **3000** is only the “logical” default for the main app; Railway can assign any port and set `PORT`. Next.js uses `PORT` when present, so you don’t need to hardcode it in the start command.

**Running admin locally:** From the `admin/` folder run `PORT=3001 bun run start` (or `PORT=3001 npm run start`) so the admin app listens on 3001 and doesn’t conflict with the main app on 3000.
