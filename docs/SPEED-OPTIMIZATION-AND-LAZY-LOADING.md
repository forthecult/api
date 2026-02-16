# Speed optimization and lazy loading

This document describes how the webapp stays fast: build and server config, route prefetching, code-splitting and lazy loading across the site, image handling, checkout/payment-specific optimizations, and provider scoping. Use it to maintain and extend these patterns so they are not lost when making changes.

## Goals

- **Smaller initial JS** – Heavy or below-the-fold UI lives in separate chunks and loads only when needed or when the user shows intent.
- **Faster navigation** – Critical routes and checkout/payment chunks are prefetched so navigation often feels instant.
- **Efficient assets** – Compression, cache headers, optimized package imports, and image best practices reduce payload and improve repeat visits.
- **Single source of data where possible** – e.g. one order fetch on the payment page, shared by layout and pay clients.
- **Provider scoping** – Heavy SDK providers (wagmi, wallet adapters, UploadThing) are only loaded in the routes that need them, not globally.
- **Deferred API calls where safe** – Some non-critical API calls (e.g. notifications, support chat visibility) are deferred until interaction or idle. Categories and crypto prices fetch on mount for stability and to avoid UI flashing.

---

## 1. Build and server configuration

**File:** `next.config.ts`

- **Compression** – `compress: true` enables gzip/brotli for responses.
- **Optimized package imports** – `experimental.optimizePackageImports` includes:
  - `lucide-react`, Radix UI packages, `framer-motion`, `date-fns`, `class-variance-authority`, `clsx`, `sonner`, `cmdk`, `vaul`, `zod`
  - Reduces bundle size by tree-shaking and only pulling in what each page uses.
- **Cache headers** – Static assets (images, fonts, `/_next/static/*`) get long-lived `Cache-Control: public, max-age=31536000, immutable` so browsers cache them aggressively.

**Bundle analysis:** From the webapp root, run `bun run analyze` to build with the bundle analyzer. The report opens in the browser (and is written under `.next`). Use it to confirm chunk boundaries, spot large dependencies, and verify new routes/components are in the right chunks.

**How to use the analyzer for “Reduce unused JavaScript”:** After `bun run analyze`, the report shows client bundles (e.g. “client” or “first load”) with chunk sizes. PageSpeed reports chunk filenames like `...chunks/8886-....js` — the number (8886) is the webpack chunk ID and can change between builds. In the analyzer: (1) Find the largest client chunks by size. (2) Click a chunk to see which modules it contains. (3) If a chunk used on the homepage contains code for other routes (checkout, dashboard, etc.), split that code with `next/dynamic` or move it to a route-specific layout. (4) If the header or a layout component is in a large chunk, consider loading it after idle (e.g. `DeferredHeader`).

**Maintenance:** When adding a large dependency used in only some routes, consider adding it to `optimizePackageImports` if the package supports it, and keep heavy UI in dynamically imported components.

---

## 2. Provider scoping (root layout)

**File:** `src/app/layout.tsx`

The root layout wraps every page. Theme, cart, crypto/currency, prefetcher, auth wallet modal provider, and WagmiProvider live here; other heavy SDKs (Solana, Sui, MetaMask, UploadThing) are scoped to the routes that need them.

### What IS in the root layout

| Provider | Weight | Why global |
|----------|--------|------------|
| `ThemeProvider` | ~2KB | Theme must wrap every page |
| `CartProvider` | ~3KB | Cart is used site-wide |
| `CryptoCurrencyProvider` | ~5KB | Crypto price display in footer/products; API fetch on mount |
| `CountryCurrencyProvider` | ~15KB | Currency display site-wide; reads cookie, defers exchange-rate fetch |
| `DeferredCriticalRoutePrefetcher` | 0 KB initial | Prefetches `/checkout`, `/products`; chunk loads after **requestIdleCallback** so it doesn’t compete with LCP. |
| `AuthWalletModalProvider` | ~2KB | Event listener only; modal shell is dynamic |
| `WalletErrorBoundary` | ~1KB | Lightweight error boundary |
| `LazyWagmiProvider` | 0 KB initial | Wagmi + viem + chains are **not** in the initial bundle. The gate listens for `PRELOAD_AUTH_WALLET_MODAL` / `OPEN_AUTH_WALLET_MODAL` (e.g. hover or click "Connect wallet"); only then does it dynamic-import `wagmi-provider` and mount it. Once loaded, the provider stays mounted for the session. The auth modal shell shows a loading state until Wagmi is ready. |
| `LazySolanaWalletProvider` | Stub only initial | Renders a tiny **stub** (WalletContext only) so `useWallet()` doesn’t throw; the real Solana provider (adapters, Phantom, Solflare, etc.) loads after **requestIdleCallback** (~1.5s timeout), then swaps in. Reduces initial JS on every store page. |

### What is NOT in the root layout (scoped to routes)

| Provider | Where it lives | Why |
|----------|----------------|-----|
| **NextSSRPlugin** (UploadThing) | `dashboard/layout.tsx` | File uploads only happen in dashboard |
| **SolanaWalletProvider** | `auth-wallet-modal-shell.tsx` and `checkout/[invoiceId]/layout.tsx` | Only needed for wallet auth and Solana payments; modal shell is lazy-loaded |
| **SuiWalletProvider** | `checkout/[invoiceId]/layout.tsx` | Only needed for Sui payments |
| **MetaMaskProvider** | `checkout/[invoiceId]/layout.tsx` | Only needed for EVM payments |

**Note:** The root uses `LazyWagmiProvider`, which defers loading the Wagmi chunk until the user opens or preloads the auth wallet modal. This keeps ~200KB (Wagmi + viem + chains) out of the initial bundle. Checkout invoice layout still has its own `WagmiProvider` for payment pages.

**Maintenance:**
- When adding a new heavy provider (chart library, etc.), scope it to the route that needs it. Do not remove `LazyWagmiProvider` from the root without re-testing wallet connect and checkout flows.
- NextSSRPlugin stays in dashboard layout only.

---

## 3. Route prefetching

**Files:** `src/ui/components/critical-route-prefetcher.tsx`, `src/ui/components/deferred-critical-route-prefetcher.tsx`

- **What:** A client component that prefetches critical routes with the Next.js router. The root layout uses **DeferredCriticalRoutePrefetcher**, which loads the prefetcher chunk after `requestIdleCallback` so it doesn’t compete with LCP.
- **Routes prefetched:** `/checkout`, `/products`.
- **Where used:** Rendered in the root layout; prefetch runs soon after idle.

**Maintenance:** If you add another high-value route (e.g. a new shop or collection entry point), consider adding it to the prefetcher. Do not prefetch too many routes or you will waste bandwidth; keep it to a small set of primary navigation targets.

---

## 4. Homepage data loading (no streaming)

**File:** `src/app/page.tsx`

The homepage is an **async server component** that fetches all data up front, then renders the full page. It does **not** use React Suspense streaming.

- **Behavior:** The default export is `async function HomePage()`. It awaits `cookies()`, then runs `Promise.all([fetchCategories(), getCategoriesWithProductsAndDisplayImage({ topLevelOnly: true }), fetchFeaturedProducts(cookieHeader), fetchReviewsForTestimonials()])`. After all data is ready, it renders hero, brand statement, lookbook, categories grid, featured products grid, "Why choose us", testimonials, and CTA in one pass.
- **Why no streaming:** Suspense streaming on the homepage caused picture flashing and layout/ordering issues. Fetching everything first then rendering avoids those problems.
- **Components:** `FeaturedProductsSection` and `TestimonialsSection` are used with the fetched data; both are loaded via `next/dynamic` with skeletons (separate chunks).

**Maintenance:**
- When adding a new data-dependent section to the homepage, add its fetch to the same `Promise.all` and render the section with the resulting data. Do not reintroduce Suspense boundaries on this page without re-testing for flashing and "order total" type bugs.

---

## 5. Code-splitting and lazy loading (site-wide)

Heavy or non–first-paint UI is loaded with `next/dynamic` (or equivalent) so it lives in separate chunks. Below is where this is used and how to preserve or extend it.

### 5.1 Layout and global UI

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Footer** | `conditional-footer.tsx` | Footer is not in the initial bundle. A sentinel is rendered; when the user scrolls to ~60% (IntersectionObserver), the Footer is loaded via `next/dynamic` (`LazyFooter`). Sideshift widget loads on first click and retries if the script sets `window.sideshift` asynchronously. |
| **Footer content** | `footer.tsx` | `FooterDogePeek` is dynamic with `ssr: false`. |
| **Support chat** | `support-chat-widget-wrapper.tsx` | Widget is dynamic; loading is deferred 10s after mount, then visibility is fetched and the widget chunk is loaded only if visible. Hidden on `/telegram`. |
| **Auth wallet modal** | `auth-wallet-modal-provider.tsx` | `AuthWalletModalShell` is dynamic; loads when the modal is opened or when `PRELOAD_AUTH_WALLET_MODAL` is fired (e.g. hover over header profile/wallet). The shell includes SolanaWalletProvider. Wagmi is lazy-loaded by `LazyWagmiProvider` (root) on the same events; the shell shows a loading state until Wagmi is ready. |

### 5.2 Header and navigation

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Header** | `deferred-header.tsx` | **DeferredHeader** shows a minimal placeholder (logo bar) until `requestIdleCallback` (100 ms), then loads **ConditionalHeader** (TopBanner + Header) via `next/dynamic`. The full header chunk (auth, Cart, ShopMegaMenu, etc.) does not block LCP. Inside the header: `Cart` loads when requested (preload or hover). `ShopMegaMenu` is dynamic on first hover/focus on Shop. `NotificationsWidget` is dynamic when user is authorized and has website notifications enabled. Categories fetch only on hover/focus or when opening mobile menu. |
| **Mobile nav** | `mobile-nav-sheet.tsx` | `Cart` and `FooterPreferencesModal` are dynamic; modal loads only when the user opens preferences. |

### 5.3 Home and marketing

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Home page** | `app/page.tsx` | Default export is async; fetches categories, featured products, and testimonials in `Promise.all` then renders (no Suspense). `FeaturedProductsSection` and `TestimonialsSection` are loaded via `next/dynamic` with skeletons (separate chunks, faster initial parse). |

### 5.4 Products and catalog

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Featured products** | `FeaturedProductsSection.tsx` | `ProductQuickView` is dynamic with `ssr: false`; the quick-view modal and its deps load only when the user opens a product quick view. |
| **Related products** | `related-products-section.tsx` | Same: `ProductQuickView` is dynamic so the product detail modal is in its own chunk. |
| **Product listing** | `products-client.tsx` | Product grid images use `priority={index < 4}` for the first four items to improve LCP; rest load lazily. |

### 5.5 Dashboard and account

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Dashboard layout** | `sidebar-loader.tsx` | `DashboardSidebar` is dynamic with a skeleton; keeps dashboard sidebar in a separate chunk. |
| **Profile** | `profile-loader.tsx` | `ProfileViewClient` and `EditProfilePageClient` (edit page) are dynamic with skeletons. |
| **Security** | `security-loader.tsx` | Security page client is dynamic. |
| **Wishlist** | `wishlist-loader.tsx` | Wishlist client is dynamic. |
| **Uploads** | `dashboard/uploads/page.client.tsx` | Uploads page uses dynamic imports for heavy UI. UploadThing `NextSSRPlugin` lives in dashboard layout only. |

### 5.6 Auth (login / signup)

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Login** | `login-loader.tsx` | Login form/client is dynamic. |
| **Signup** | `signup-loader.tsx` | Signup form/client is dynamic. |

### 5.7 Other routes

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **API docs** | `api/docs/page.tsx`, `api-docs-client.tsx` | API documentation UI is dynamic. |
| **Telegram** | `telegram/page.tsx` | Telegram-specific client is dynamic. |
| **Telegram checkout** | `telegram/checkout/page.tsx` | Checkout for Telegram flow is dynamic. |

**Maintenance:**

- When adding a **new route or feature** that pulls in heavy deps (wallet libs, charts, rich editors, etc.), use a loader pattern: a thin page that renders a component loaded via `next/dynamic` with a loading state (skeleton or placeholder) and `ssr: false` if the component depends on browser APIs.
- If you **move or rename** a file that is dynamically imported, update every `import("...")` path that references it (including any prefetch helpers like `prefetch-checkout.ts`).
- Prefer a **single dynamic import per logical feature** so the same chunk is used everywhere (e.g. one import for Cart, one for ProductQuickView).

---

## 6. Deferred API calls

Not all API calls need to fire on mount. Deferring non-critical fetches reduces the number of concurrent requests on initial load and speeds up Time to Interactive.

| API call | Trigger | File |
|----------|---------|------|
| `/api/categories` (header mega menu) | Only on hover/focus of Shop nav item or when opening mobile menu (not on mount) | `header.tsx` |
| `/api/user/notifications` (header bell) | On mount for logged-in users, then cached in `sessionStorage`. Bypasses cache on `NOTIFICATION_PREFS_UPDATED` event. | `header.tsx` |
| `/api/crypto/prices` | 2-second delay after mount; fallback rates show until then | `use-crypto-currency.tsx` |
| `/api/geo` + exchange rates | On mount only if no cookie/localStorage cache; exchange rates cached 1 hour | `use-country-currency.tsx` |
| `/api/support-chat/widget-visible` | 10-second delay after mount | `support-chat-widget-wrapper.tsx` |

**Maintenance:**
- When adding a new API call to a global component (header, footer, provider), defer it unless it is needed for above-the-fold rendering.
- Use `sessionStorage` or `localStorage` to cache results that don't change within a session (like notification preferences, user country).
- Set short timeouts (5s) with `AbortController` so slow APIs don't block navigation.

---

## 7. Images

- **`next/image`** is used for product and marketing images; the runtime optimizes format and sizing.
- **Remote images (https):** Only `data:` and `http:` URLs use `unoptimized={true}`. All **https** remotes (Printful, ufs.sh, UploadThing, etc.) go through Next Image Optimization so the server can resize and serve WebP/AVIF, reducing download size (PageSpeed “Reduce the download time of images”).
- **Priority:** Images critical for LCP (e.g. hero, first few product tiles, auth pages) use `priority` so they are not lazy-loaded. Examples:
  - `products-client.tsx`: `priority={index < 4}` for the first four products.
  - `page.tsx` (homepage): Lookbook image uses `priority`. First 2 category images use `priority={index < 2}`.
  - Auth sign-in/sign-up and about page: hero/logo images use `priority`.
  - Product detail gallery: `priority` when showing the default (first) product image.
- **Product card** (`product-card.tsx`) accepts a `priority` prop and passes it to `next/image`; callers set it for above-the-fold items.
- **Sizes:** Use `sizes` so the browser requests appropriately sized sources. Product cards cap at `284px` for the grid; category tiles on homepage use `(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px`. `next.config.ts` `imageSizes` includes 192 and 320 for 138px/284px displays.

**Maintenance:** For new high-impact images, set `priority` only for the few that affect LCP. Keep `unoptimized` only for `data:` and `http:`; add new image hosts to `remotePatterns` in `next.config.ts` if needed.

---

## 8. Fonts

**File:** `src/app/layout.tsx`

Four font families are loaded via `next/font/google`:

| Font | CSS variable | Usage | Weights |
|------|-------------|-------|---------|
| Geist Sans | `--font-geist-sans` | Body text | Auto (variable font) |
| Geist Mono | `--font-geist-mono` | Code, monospace | Auto (variable font) |
| JetBrains Mono | `--font-mono-crypto` | Crypto prices, ticker | Auto (variable font) |
| Manrope | `--font-heading` | Headings, brand text | 600, 700, 800 only |

**Maintenance:**
- Manrope weights are limited to 600 (semibold), 700 (bold), 800 (extrabold). Do not add 400 or 500 — they increase font download size without being used.
- If you need a new font, check if an existing one covers the use case first.
- If adding a font that is only used on specific routes, consider loading it in a route-specific layout instead of the root layout.

---

## 9. Checkout and payment

Checkout and payment routes use **prefetch-on-intent**, **code-splitting**, **lazy SDK loading**, **conditional providers**, and **earlier data loading** so the first interaction (open cart, go to checkout, choose payment, land on payment page) feels fast.

### Prefetch on intent

- **Checkout chunk:** Prefetched when the cart opens or when the user hovers/focuses the "Checkout" link (in `cart-client.tsx` and `prefetch-checkout.ts`).
- **Payment client chunks:** Prefetched when the user selects a payment method that goes to `/checkout/[invoiceId]` (in `PaymentMethodSection.tsx`: e.g. `prefetchCryptoPayClient()`, `prefetchBtcPayClient()`, etc.).

### Lazy SDK loading

- **Stripe SDK** (`@stripe/stripe-js`): Loaded lazily via dynamic `import()`; shared cache in `stripe-preload.ts`. **Preload on intent:** when the user hovers or focuses the "Credit/debit card" option, `preloadStripe()` runs so the SDK starts loading before they click. When they select credit card, `StripeCardPayment` and `ExpressCheckout` use the cached promise so the form appears quickly. **Do not switch back to a top-level `import { loadStripe }`** — that would download the Stripe SDK on every checkout page load.
- **Wallet SDKs**: See Provider Scoping (section 2).

### Wallet providers (invoice layout)

**File:** `src/app/checkout/[invoiceId]/layout.tsx`

The invoice layout renders **all** wallet providers (WagmiProvider, MetaMaskProvider, SuiWalletProvider, SolanaWalletProvider) for every payment page. This keeps the React tree stable — conditionally adding/removing providers causes children to unmount/remount, which breaks wallet context access and causes crashes.

**Do NOT conditionally render providers based on paymentType.** The providers themselves are lightweight wrappers; the heavy SDK code is already in separate chunks loaded by the dynamic pay clients (CryptoPayClient, EthPayClient, etc.).

### Code-splitting

- Checkout page: `checkout-loader.tsx` loads `CheckoutClient` via `next/dynamic`; `CheckoutClient` loads `PaymentMethodSection` dynamically with a skeleton.
- Payment page: `crypto-pay-loader.tsx` dynamically imports CryptoPayClient, EthPayClient, BtcPayClient, TonPayClient and renders one based on `paymentType`.

### Earlier data

- Invoice layout wraps with `OrderPrefetchProvider`, which fetches the order once. The layout uses it for `paymentType` (to select providers and header); the loader uses it for `paymentType` and passes the same order as `initialOrder` to the pay client so they do not fetch again.

**Full checkout/payment detail:** See `src/app/checkout/README.md` for file locations, maintenance checklists, and how to add new payment methods or preserve prefetch/initialOrder behavior.

---

## 10. Maintenance checklist (when changing the app)

- [ ] **New heavy route or feature** – Prefer a loader + `next/dynamic` with a loading state; avoid putting large deps in the main or layout bundle.
- [ ] **New heavy provider** – Scope it to the route that needs it. Wagmi is already lazy in root via `LazyWagmiProvider`; do not add other heavy wallet/SDK providers to the root layout.
- [ ] **New payment method or pay client** – Add prefetch in `prefetch-checkout.ts` and call it from the handler that navigates to the payment page; support `initialOrder` in the pay client so the layout's order fetch is reused (see checkout README). Add conditional provider loading in the invoice layout.
- [ ] **Moved or renamed dynamically imported file** – Update all dynamic `import("...")` and any prefetch helpers that use the same path.
- [ ] **New above-the-fold image** – Set `priority` only for the few images that affect LCP.
- [ ] **New data section on homepage** – Add the fetch to the async `HomePage`’s `Promise.all` and render the section with the fetched data (no Suspense on homepage; we avoid streaming there to prevent flashing).
- [ ] **New API call in header or global component** – Prefer deferring to interaction or idle where safe (e.g. categories on hover/focus, crypto prices after 2s).
- [ ] **New font or font weight** – Check if an existing font covers the use case. Keep Manrope weights minimal.
- [ ] **New high-value navigation target** – Consider adding it to `CriticalRoutePrefetcher` if it should feel instant on first click.
- [ ] **Bundle size** – After significant changes, run `bun run analyze` and confirm chunk boundaries and sizes are still acceptable.

---

## 11. Best practices

### Do

- **Scope providers to routes.** If a provider is only needed on 2-3 routes, put it in those route layouts, not the root layout.
- **Defer API calls where safe.** For non-critical UI (e.g. support chat, some notifications), fetch on interaction or idle. Categories and crypto prices fetch on mount to avoid flashing and context issues.
- **Lazy-load third-party SDKs.** Use dynamic `import()` for Stripe, wallet SDKs, chat widgets, and similar. Only load when the user needs them.
- **Cache API results.** Use `sessionStorage` for results that don't change within a session (notification prefs, geo, exchange rates).
- **Set image `priority`.** Only for above-the-fold images that affect LCP. Use `sizes` to avoid downloading unnecessarily large images.
- **On the homepage, fetch then render.** We do not use Suspense streaming there; the async page awaits all data then renders to avoid picture flashing and ordering bugs.
- **Run `bun run analyze` after big changes.** Check that new dependencies landed in the right chunks and didn't bloat the main bundle.

### Don't

- **Don't remove LazyWagmiProvider from the root layout** without re-testing wallet connect and checkout. The lazy gate keeps Wagmi out of the initial bundle while still providing it when the auth modal is opened or preloaded.
- **Don't conditionally render wallet providers** in the checkout invoice layout based on paymentType. React tree restructuring causes children to unmount/remount and breaks wallet context access.
- **Don't call `loadStripe()` at module level or in a `useState` initializer** unless the Stripe form is guaranteed to be visible. Use `useEffect` with a dynamic `import()`.
- **Don't reintroduce Suspense streaming on the homepage** without re-testing for image flashing and "order total" type issues; we use fetch-all-then-render there by design.
- **Don't fetch data on every navigation** if it doesn't change often. Cache in `sessionStorage` or a React context.
- **Don't add font weights that aren't used.** Each weight adds to the font download size.
- **Don't put `NextSSRPlugin` (UploadThing) in the root layout.** It only belongs in the dashboard where uploads happen.

---

## 12. Further options (considered, not applied)

- **Homepage above-the-fold:** Featured products section is now in a separate chunk (dynamic import with skeleton). Hero, lookbook, and first category images already use `priority`. LCP is largely limited by main-bundle parse (Wagmi + layout).
- **Wagmi lazy load:** Implemented via `LazyWagmiProvider`. Wagmi is loaded only when the user opens or preloads the auth wallet modal (same events as the modal shell). No full-app remount: the provider is inserted into the tree when the chunk loads; the auth modal shows a loading state until then.
- **Homepage Suspense streaming:** Would improve TTFB but caused image flashing and ordering issues; we use fetch-all-then-render.
- **Checkout:** Already prefetched via `CriticalRoutePrefetcher`; CheckoutClient and PaymentMethodSection are dynamic; Stripe loads only when card is selected.
- **Payment page:** Pay clients (CryptoPayClient, etc.) are dynamic and prefetched on payment-method selection. Conditional wallet providers were reverted (tree stability).
- **Preconnect:** `next.config.ts` already sends `dns-prefetch` / `preconnect` for image CDNs (utfs.io, 9qeynzupxi.ufs.sh, Printify, etc.). Same-origin API calls do not need preconnect.
- **Fonts:** Manrope is limited to 600/700/800 and uses `display: "swap"`; `next/font` handles loading. No further reduction without design change.

---

## 13. Google PageSpeed Insights – desktop findings and mitigations

When running desktop PageSpeed, the following have been addressed or documented:

| Finding | Mitigation |
|--------|------------|
| **LCP element render delay** (hero `<h1>`) | LCP is the hero heading. Reduce main-thread work (see long tasks / unused JS). Manrope uses `display: "swap"` so text can paint with fallback while font loads. |
| **Improve image delivery / responsive images** | Product card images use `sizes` capped at `320px` for grid (displayed ~284px). Use `sizes` on all `next/image` so the optimizer serves appropriate widths. |
| **Use efficient cache lifetimes** | Our static assets (`/_next/static/*`, images, fonts) use `Cache-Control: public, max-age=31536000, immutable`. Third-party image CDN (e.g. ufs.sh) sets its own headers; we cannot change those. |
| **Legacy JavaScript (polyfills)** | `package.json` includes a modern `browserslist` so tooling can avoid transpiling baseline features. Remaining polyfills may come from dependencies. |
| **Reduce unused JavaScript / long main-thread tasks** | Code-splitting and lazy loading are in place (sections 2–5). Homepage: `FeaturedProductsSection` and `TestimonialsSection` are loaded via `next/dynamic` so their JS is in separate chunks. Run `bun run analyze` to see which modules land in which chunks and find further split opportunities. |
| **Forced reflow** | Avoid reading layout (e.g. `getBoundingClientRect`, `offsetWidth`) immediately after DOM writes; batch reads or use `requestAnimationFrame`. Some reflows come from third-party chunks. |

### Desktop (PageSpeed desktop)

- **Reduce the download time of images (est. ~497–998 KiB):** Addressed by (1) enabling Next Image Optimization for all **https** remote images (only `data:` and `http:` use `unoptimized`), so Printful/ufs.sh/etc. are resized and served as WebP/AVIF; (2) adding `imageSizes` 192 and 320 in `next.config.ts` for 138px/284px displays; (3) tightening `sizes` on product cards to `284px` and category grid to `192px` so the browser requests smaller sources. Legacy JavaScript (12 KiB polyfills) and unused JS (~361 KiB) remain; `browserslist` is already modern-only; further savings require dependency or chunk analysis.
- **LCP breakdown:** Element render delay (~2.69 s) — LCP element is the hero `<h1>` (“Where culture and technology converge”). Reducing main-thread work (unused JS, long tasks) is the primary lever; fonts use `display: "swap"`.
- **Forced reflow:** Layout reads in `data-table-filter.tsx` are wrapped in `requestAnimationFrame`; remaining reflow is from framework/deps chunks.
- **Reduce unused JavaScript (~361 KiB est.):** Chunks 8886 (~267 KiB), 49821, 30156, 3a91511d. Prefetcher prefetches only `/products`; checkout/crypto loads on intent. Run `bun run analyze` for further split opportunities.
- **Legacy JavaScript (12 KiB):** Polyfills for `Array.prototype.at`, `Object.fromEntries`, etc. `browserslist` is modern-only; remaining polyfills may come from dependencies.
- **Use efficient cache lifetimes:** Static assets use long cache; third-party CDN (ufs.sh, etc.) set their own headers.

### Mobile-specific (PageSpeed mobile)

- **LCP breakdown:** Element render delay (~2.85 s) is the main cost; TTFB is 0 ms. The LCP element is the brand `<h2>` (“We curate tech, apparel, wellness, and travel gear that fits how you live…”). The delay is main-thread blocking: reduce JS parse/execution before first paint. **Mitigations:** (1) **DeferredHeader** — the full header (TopBanner + Header with Cart, Shop menu, auth, etc.) is loaded after `requestIdleCallback` (100 ms). A minimal placeholder (logo bar, same height) shows until then so the header chunk does not block LCP. (2) **LazySolanaWalletProvider** uses a longer idle timeout on mobile (4 s). (3) **DeferredCriticalRoutePrefetcher** uses 3.5 s idle on mobile (2 s on desktop). (4) **DeferredSpeedInsights** and **TestimonialsSection** remain lazy; prefetcher does not prefetch `/checkout`.
- **Reduce unused JavaScript (~339 KiB est. mobile, ~361 KiB desktop):** Largest chunk: **8886** (~316 KiB transfer, ~246–267 KiB est. savings). Others: 49821, 30156, 3a91511d. **DeferredHeader** moves the header (and its deps) into a separate chunk that loads after idle, reducing the initial client bundle. Run `bun run analyze` (see §1) to see which modules remain in the largest chunks and split further. Checkout/crypto loads only on intent.
- **Forced reflow:** Chunks 93794 and 66609 contribute reflow time. **Mitigation:** Product image gallery zoom (`product-image-gallery.tsx`) now wraps `getBoundingClientRect` in `requestAnimationFrame` so the layout read is deferred; `data-table-filter.tsx` already uses rAF for scroll/layout reads. Remaining reflow is from framework/deps.
- **Improve image delivery (mobile):** Same as desktop (responsive `sizes`, Next Image Optimization for https remotes, `imageSizes` 192/320).
- **Legacy JavaScript / cache:** Same as desktop; ufs.sh cache is third-party.

---

## 14. Ideas for further improvement

- **More route prefetching:** If analytics show other routes (e.g. category or collection pages) as common first clicks, consider prefetching them in `CriticalRoutePrefetcher` or on hover/focus of nav links.
- **Checkout:** If you add a cart or session API, consider starting that request from the checkout layout or a small client component so data is in flight before CheckoutClient mounts.
- **Heavy components:** If any client (checkout, payment, dashboard, etc.) grows, consider splitting modals, tabs, or secondary UI with `next/dynamic` and keep the critical path minimal.
- **Support chat:** The 10s defer and visibility check could be tuned (e.g. by route or user segment) if you want the widget to load sooner on some pages.
- **Server-side crypto prices:** Move the crypto price fetch to a server component or API route with ISR so the client doesn't need to fetch at all on first render.
- **Partial prerendering:** When Next.js stabilizes PPR, consider enabling it for the homepage so the static shell is served from the edge while dynamic sections load, if it can be done without reintroducing the flashing/ordering issues we avoided by removing Suspense there.
- **Header:** Implemented as **DeferredHeader** — minimal placeholder (logo bar) renders immediately; full header chunk loads after idle. Cart, ShopMegaMenu, and auth dropdowns remain in the header chunk (they load when the header loads). Further split (e.g. Cart in its own chunk) is possible but Cart is already dynamic and loads on interaction.
