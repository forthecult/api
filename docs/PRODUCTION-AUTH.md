<!-- INTERNAL — DO NOT PUBLISH. Contains deployment details and env var names. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->

# Production auth troubleshooting

If GitHub (or Google) sign-in works on staging but fails on production with **429** or **500**, use this checklist.

## 500: Missing database tables (verification, support_chat_setting, etc.)

If your logs show:

- `relation "verification" does not exist` (during sign-in/social or OAuth callback)
- `relation "support_chat_setting" does not exist` (support chat widget)

then the **production database schema is out of date**. Staging has these tables; production doesn’t.

**Fix:** Apply the current schema to the production database so all required tables exist.

1. **From your machine (recommended)**  
   Point Drizzle at the production DB and push the schema (no data loss; only adds missing tables/columns):

   ```bash
   DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname" bun run db:push
   ```

   Use your real production `DATABASE_URL` (from Railway, Vercel, etc.). Do not commit it; use env or a one-off export.

2. **From the production host**  
   If the app runs in an environment that already has `DATABASE_URL` set (e.g. Railway), you can run the same command in that environment (e.g. via Railway’s shell or a one-off job):

   ```bash
   bun run db:push
   ```

After `db:push` completes, the `verification` table (used by better-auth for OAuth state) and `support_chat_setting` (and any other missing tables) will exist, and sign-in and the support widget should stop returning 500.

## 429 Too Many Requests

- **Cause:** Auth endpoints are rate-limited per IP (60/min). If your host does not send the client IP (e.g. missing `X-Forwarded-For`), every request is counted under one bucket and legitimate users get 429.
- **Code fix:** When the client IP is `"unknown"`, we use a higher limit (300/min) so the whole site isn’t blocked. Deploy that change if you see 429 in prod.
- **Proper fix:** Configure your reverse proxy / host to forward the client IP:
  - **Railway:** Ensure the request passes through with `X-Forwarded-For` (or set it in Railway if supported).
  - **Vercel:** Sends `x-forwarded-for` by default.
  - **Cloudflare:** Sends `CF-Connecting-IP` (we read this).

## 500 on sign-in/social (e.g. GitHub)

1. **GitHub OAuth App**
   - GitHub → Settings → Developer settings → OAuth Apps → your app.
   - **Authorization callback URL** must be exactly:
     - Production: `https://forthecult.store/api/auth/callback/github`
     - Staging: your staging base URL + `/api/auth/callback/github` (e.g. `https://your-staging.up.railway.app/api/auth/callback/github`).
   - You can have **one** OAuth App with **multiple** callback URLs if your provider supports it; otherwise create a separate OAuth App for production and set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` per environment.

2. **Environment variables (production)**
   - `NEXT_PUBLIC_APP_URL` = `https://forthecult.store` (no trailing slash). Used as `baseURL` for callbacks.
   - `AUTH_SECRET` = same strong secret as staging (or a new one; must be set).
   - `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` = production OAuth App credentials if you use a separate app.

3. **Server logs**
   - On 500, the auth route logs: `[auth] Server error response: 500 <body>`.
   - Check your production logs for that line; the body usually contains the better-auth error (e.g. callback URL mismatch, invalid state).

4. **Google**
   - Same idea: in Google Cloud Console, add the production callback URL (e.g. `https://forthecult.store/api/auth/callback/google`) to the OAuth client’s authorized redirect URIs.
