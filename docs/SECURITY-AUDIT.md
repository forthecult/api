# Dependency Security Audit

**Audit date:** 2026-02-07  
**Tool:** `bun audit` (Bun v1.2.23)

---

## Summary

| Package        | Vulnerabilities | High | Moderate | Low |
|----------------|-----------------|------|----------|-----|
| **relivator**  | 11              | 3    | 5        | 3   |
| **relivator-admin** | 0 *(upgraded 2026-02-07)* | 0 | 0 | 0 |
| **contracts**  | —               | —    | —        | —   (no lockfile) |

---

## 1. Main app (`relivator/`)

### High severity

| Package        | Affected by                    | Issue |
|----------------|--------------------------------|--------|
| **semver**     | sharp, @walletconnect/*, typescript-eslint, @metamask/*, @solana/*, eslint-plugin-perfectionist, @eslint-react/* | Regular Expression Denial of Service (ReDoS). [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw), [GHSA-x6fg-f45m-jf5q](https://github.com/advisories/GHSA-x6fg-f45m-jf5q) |
| **bigint-buffer** | @solana/spl-token › @solana/buffer-layout-utils | Buffer overflow in `toBigIntLE()`. [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) |

### Moderate severity

| Package    | Affected by                    | Issue |
|------------|--------------------------------|--------|
| **esbuild** | drizzle-kit                   | Dev server can be used to proxy arbitrary requests and read responses. [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — *dev-only*. |
| **lodash** | swagger-ui-react, @walletconnect/*, @solana/wallet-adapter-walletconnect | Prototype pollution in `_.unset` / `_.omit`. [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |
| **bl**     | @metamask/sdk-react › rollup-plugin-node-builtins › … › levelup | Remote/memory exposure. [GHSA-pp7h-53gx-mx7r](https://github.com/advisories/GHSA-pp7h-53gx-mx7r), [GHSA-wrw9-m778-g6mc](https://github.com/advisories/GHSA-wrw9-m778-g6mc) |
| **js-yaml** | knip, swagger-ui-react, eslint, @metamask/*, @solana/*, @walletconnect/* | Prototype pollution in merge (`<<`). [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m) |

### Low severity

| Package           | Affected by                    | Issue |
|-------------------|--------------------------------|--------|
| **brace-expansion** | eslint, typescript-eslint, swagger-ui-react, @eslint-react/*, @metamask/*, @solana/*, @walletconnect/* | ReDoS. [GHSA-v6h2-p8h4-qcjw](https://github.com/advisories/GHSA-v6h2-p8h4-qcjw) |
| **elliptic**      | @walletconnect/*, @solana/wallet-adapter-walletconnect, @metamask/sdk-react | Risky crypto implementation. [GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84) |

---

## 2. Admin app (`relivator/admin/`)

All 5 issues are in **Next.js** (direct + via better-auth):

| Severity  | Advisory |
|-----------|----------|
| **High**  | HTTP request deserialization can lead to DoS with insecure RSC. [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) |
| **Moderate** | Cache key confusion (Image Optimization). [GHSA-g5qg-72qw-gw5v](https://github.com/advisories/GHSA-g5qg-72qw-gw5v) |
| **Moderate** | Content injection (Image Optimization). [GHSA-xv57-4mr9-wg8v](https://github.com/advisories/GHSA-xv57-4mr9-wg8v) |
| **Moderate** | SSRF via middleware redirect. [GHSA-4342-x723-ch2f](https://github.com/advisories/GHSA-4342-x723-ch2f) |
| **Moderate** | DoS via Image Optimizer `remotePatterns`. [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) |

**Cause:** Admin uses `next@15.3.8`; advisories affect Next.js `>=15.0.0 <=15.4.4`. Main app uses `next@^16.1.6`, which is outside that range.

---

## 3. Contracts (`relivator/contracts/`)

No lockfile present; `bun audit` cannot run. To audit: add a lockfile (e.g. `bun install` in `contracts/`) then run `bun audit` there.

---

## Recommended actions

### Main app (`relivator/`)

1. **Update dependencies**
   - Run `bun update` (compatible) or `bun update --latest` (may include breaking changes).
   - Re-run `bun audit` and fix any remaining issues.

2. **Optional: use overrides for transitive fixes**
   - In `package.json`, add an `overrides` (or `resolutions`) entry to force patched versions where upstreams have not yet updated (e.g. `semver@>=5.7.2`, `lodash@>=4.17.23`, `js-yaml@>=4.1.1`, `brace-expansion@>1.1.11`). Test thoroughly after adding overrides.

3. **Context-specific risk**
   - **esbuild** (drizzle-kit): dev-only; ensure dev server is not exposed in production.
   - **Wallet/crypto stack** (bigint-buffer, elliptic, bl): mostly in wallet/WalletConnect/MetaMask/Solana deps; consider upgrading those packages when fixes are available.

### Admin app (`relivator/admin/`)

1. **Upgrade Next.js** to a version that includes the fixes (e.g. align with main app and use Next 16.x if compatible with admin’s code).
2. **Done (2026-02-07):** Upgraded admin to Next.js `^16.1.6`; `bun audit` now reports no vulnerabilities. Removed deprecated `eslint` from next.config and set `turbopack.root`.

### Contracts

1. Add a lockfile under `relivator/contracts/` and run `bun audit` (or `npm audit` if you use npm there) regularly.

---

## Re-running the audit

```bash
# Main app
cd relivator && bun audit

# Admin (from relivator/admin, with lockfile)
cd relivator/admin && bun audit
```

Consider running `bun audit` in CI or pre-push hooks to catch regressions.
