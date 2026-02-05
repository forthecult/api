# Performance & Bloat Review

Quick review of changes made and optional next steps for a leaner, faster app.

## Done

### Dependencies removed (safe)
- **uuid** + **@types/uuid** – Not imported anywhere in `src/`; IDs use `cuid2` or `crypto.randomUUID`.
- **patch-package** – No `patches/` folder; no patched deps.

### Build & runtime speed
- **optimizePackageImports** in `next.config.ts` expanded so large UI/icon/date libs are tree-shaken:
  - All **@radix-ui/** packages used by the app (avatar, checkbox, dialog, dropdown, label, popover, separator, slider, slot, switch, tabs).
  - **lucide-react**, **framer-motion**, **date-fns** (already present; kept).

This reduces bundle size and can speed up cold starts and builds when using these packages.

## Optional next steps (manual)

### 1. Use Turbopack in development
```bash
bun run dev:turbo
```
Faster HMR and dev startup than default webpack.

### 2. Unused dependencies (knip; remove only if you’re sure)
- **@solana/client**, **@solana/kit** – No direct imports in `src/`. May be transitive/peer of wallet adapters; confirm before removing.
- **@tanstack/react-table**, **@tanstack/table-core** – Only used by the data-table primitives. The main storefront app doesn’t use `DataTable`; only the admin app (or future pages) might. Safe to remove from this repo only if you never plan to use data tables in the main app.

### 3. Unused files (knip)
Knip reported many “unused” files; most are:
- **admin/** – Separate app; its entry points are used by that app.
- **contracts/** – Hardhat; often excluded from app build.
- **src/** – Some primitives (e.g. data-table, calendar, command) are only referenced by other primitives that the storefront doesn’t use yet. Delete only if you’re sure you won’t need them (e.g. for a future admin in this repo).

### 4. Unused exports
Knip reported 57 unused exports (e.g. in `api-error.ts`, `contracts/abis.ts`, `printful.ts`, `printify.ts`). Cleaning these is optional; it can simplify the public API and help tree-shaking. Prefer doing it incrementally and running tests.

### 5. Unlisted dependencies
- **better-call** – Used by auth plugins; likely brought in by **better-auth**. No change needed.
- **nanoid** – Used in printful/printify sync; may be transitive. If `bun install` and build succeed, no action needed; otherwise add **nanoid** to `dependencies`.

## Summary
- Removed 3 dependencies (uuid, @types/uuid, patch-package).
- Expanded `optimizePackageImports` for all used Radix packages + existing lucide/framer-motion/date-fns.
- For maximum speed in dev, use `bun run dev:turbo`.
