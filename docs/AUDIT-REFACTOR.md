# Website Audit & Refactor (Clean Code, Performance, Maintainability)

Summary of duplication and over-engineering findings and the refactors applied. Goal: clean code, fast site, easy to change without breakage.

---

## 1. Product detail: duplicate fetch and mapping (fixed)

### Problem
- **`/products/[id]/page.tsx`** fetched product via **HTTP** to its own API (`GET /api/products/${id}`), then mapped the JSON response to a page `Product` type (~80 lines of mapping).
- **`[slug]/page.tsx`** used **direct DB** via `getProductBySlugOrId(slug)` and had a **separate** ~50-line mapping to a local `Product` type.
- Two product shapes, two mapping implementations, and an extra network hop for `/products/[id]`.

### Changes
- **`src/lib/product-for-page.ts`** added as single source of truth:
  - `PageProduct` type (one shape for both routes).
  - `mapProductBySlugResultToPageProduct(data)` — single mapper from `ProductBySlugResult`.
- **`/products/[id]/page.tsx`** now calls `getProductBySlugOrId(id)` on the server and uses the shared mapper (no self-fetch, no duplicate mapping).
- **`[slug]/page.tsx`** uses the same mapper and `PageProduct`; local `Product` interface and `fetchProductBySlug` mapping removed.

### Result
- One product type and one mapping; `/products/[id]` is faster (no HTTP round-trip); changes to product shape happen in one place.

---

## 2. Root layout: duplicated provider tree (fixed)

### Problem
- In `app/layout.tsx`, the same chain (WalletErrorBoundary → WagmiProvider → AuthWalletModalProvider → LayoutShell) was repeated in both the Suspense fallback and the real branch (inside CookieCountryProvider).

### Changes
- **`StoreLayoutWrapper`** component added: wraps children with that exact chain once.
- Fallback and actual content both render `<StoreLayoutWrapper>{children}</StoreLayoutWrapper>`.

### Result
- One place to add/remove/reorder providers; less drift and smaller layout file.

---

## 3. Cart: no duplication found

- **`Cart`** is a thin wrapper around **`CartClient`** (one line). Kept as-is.
- Cart state lives in **`use-cart.tsx`** (context + localStorage). No duplicate cart logic found.

---

## 4. Loader pattern (left as-is)

- Several routes use a “loader” that dynamic-imports a client page (e.g. `CheckoutLoader`, `LoginLoader`, `WishlistLoader`). This is intentional for code-splitting and keeping heavy client bundles out of the initial server render.
- No refactor applied; pattern is consistent and useful for performance.

---

## 5. Possible follow-ups (not done in this pass)

- **Related products**: `/products/[id]` and `[slug]` both call an API for related products (different paths: by id vs by slug). Could be unified behind one API and one type if desired.
- **`ProductListResponse` / category listing**: Only used in `[slug]` for non-product category pages. Fine to leave unless you consolidate listing types.
- **Checkout flow**: Multiple payment clients (Solana, ETH, Ton, BtcPay, etc.). Structure is feature-based; consolidating would be a larger change. Consider only if you see repeated UI or validation logic.
- **Fonts**: Four Google fonts in layout (Geist, Geist Mono, JetBrains Mono, Manrope). If not all are used, removing some would trim CSS and improve load.

---

## 6. How to extend without breaking things

- **Product fields**: Add or change fields in `PageProduct` and in `mapProductBySlugResultToPageProduct` in `lib/product-for-page.ts`. Both product detail routes pick it up.
- **Layout providers**: Change provider order or add/remove wrappers in `StoreLayoutWrapper` in `app/layout.tsx`; fallback and main tree stay in sync.
- **New product routes**: Reuse `getProductBySlugOrId` + `mapProductBySlugResultToPageProduct` so new pages stay consistent and fast.

---

*Audit and refactors completed 2026-02-15.*
