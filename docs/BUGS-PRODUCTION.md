# Production Bug Fixes

## Root cause: missing `role` column

Most production issues stem from the **user `role` column** not existing in the database. The app expects this column; if it’s missing, you get:

- Dashboard/Orders page errors
- "Failed to create order" (500)
- Products not loading (when layout/session fails)

## 1. Run the migration (required)

**Important:** Run the migration against the **production** database. If you deploy to Railway/Vercel, use the `DATABASE_URL` from that environment, not a local or staging DB.

```bash
# With DATABASE_URL in env (set to production DB)
bun run db:migrate-user-role

# Or with explicit connection string
psql "postgresql://user:pass@host:5432/db" -f scripts/migrate-add-user-role.sql
```

## 2. Verify migration

```bash
bun run db:verify-role
```

Success: `✓ User role column exists. Migration is applied.`  
Failure: follow the printed instructions to run the migration.

## 3. Check environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_SERVER_APP_URL` | Must be `https://forthecult.store` (or your production URL) so server-side fetches for products work |
| `NEXT_PUBLIC_APP_URL` | Public site URL; used for canonical links, metadata |
| `SOLANA_DEPOSIT_SECRET` | Required for Solana Pay checkout; if missing, create-order returns 503 |

## 4. Wallet connection issues

These are mostly client-side or extension-related:

| Error | Cause | Mitigation |
|-------|-------|-------------|
| `Cannot redefine property: phantom` | Multiple wallet extensions (Phantom, xDefi, etc.) fighting over globals | User can disable conflicting extensions or try another browser |
| `ERR_BLOCKED_BY_CLIENT` on `pulse.walletconnect.org` | Ad blocker or privacy extension blocking WalletConnect | User can whitelist WalletConnect or disable blocker on your site |
| `WalletNotSelectedError` | User didn’t approve in wallet, or connection race | Retry; ensure wallet is unlocked before connecting |

CSP already includes WalletConnect domains. No code changes needed for these.

## 5. Admin Customers "Failed to load customers"

Similar to the Product List, the Customers API now has a fallback when the main query fails with schema/relation errors. If the `user` table is missing columns (e.g. `role`, `receive_marketing`), it will try a simpler query, and if that fails, a minimal query (id, name, email only). In development, the actual error message is returned for debugging.

## 6. Admin Product List "Failed query"

If the admin Product List shows "Failed query" with SQL involving `product_category` or `product_variant`, the API now falls back to a products-only query when it detects schema/relation errors. You’ll still see products, but category and inventory may be empty until the schema is fixed.

To fix it properly, ensure `product_category` and `product_variant` tables exist and match the Drizzle schema. Run:

```bash
bun run db:push
```

(or your usual migration process).

## 7. Network selection modal

If the second connect attempt doesn’t show the network picker, it’s likely because:

- The wallet extension remembers the last chain
- Or the wallet standard doesn’t require a second selection

This is expected behavior for many wallets; it’s not a bug in the app.
