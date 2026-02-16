# Speed optimization and lazy loading

This document describes how the webapp stays fast: build and server config, route prefetching, code-splitting and lazy loading across the site, image handling, checkout/payment-specific optimizations, and provider scoping. Use it to maintain and extend these patterns so they are not lost when making changes.

## Goals

- **Smaller initial JS** – Heavy or below-the-fold UI lives in separate chunks and loads only when needed or when the user shows intent.
- **Faster navigation** – Critical routes and checkout/payment chunks are prefetched so navigation often feels instant.
- **Efficient assets** – Compression, cache headers, optimized package imports, and image best practices reduce payload and improve repeat visits.
- **Single source of data where possible** – e.g. one order fetch on the payment page, shared by layout and pay clients.
- **Provider scoping** – Heavy SDK providers (wagmi, wallet adapters, UploadThing) are only loaded in the routes that need them, not globally.
- **Streaming** – Server components use React Suspense to stream above-the-fold content immediately while data-dependent sections load in the background.
- **Deferred API calls** – Non-critical API calls (categories, notifications, crypto prices) are deferred until interaction or idle, not on mount.

---

## 1. Build and server configuration

**File:** `next.config.ts`

- **Compression** – `compress: true` enables gzip/brotli for responses.
- **Optimized package imports** – `experimental.optimizePackageImports` includes:
  - `lucide-react`, Radix UI packages, `framer-motion`, `date-fns`, `class-variance-authority`, `clsx`, `sonner`, `cmdk`, `vaul`, `zod`
  - Reduces bundle size by tree-shaking and only pulling in what each page uses.
- **Cache headers** – Static assets (images, fonts, `/_next/static/*`) get long-lived `Cache-Control: public, max-age=31536000, immutable` so browsers cache them aggressively.

**Bundle analysis:** From the webapp root, run `bun run analyze` to build with the bundle analyzer. The report opens in the browser (and is written under `.next`). Use it to confirm chunk boundaries, spot large dependencies, and verify new routes/components are in the right chunks.

**Maintenance:** When adding a large dependency used in only some routes, consider adding it to `optimizePackageImports` if the package supports it, and keep heavy UI in dynamically imported components.

---

## 2. Provider scoping (root layout)

**File:** `src/app/layout.tsx`

The root layout wraps every page. Only lightweight providers live here; heavy SDK providers are scoped to the routes that need them.

### What IS in the root layout

| Provider | Weight | Why global |
|----------|--------|------------|
| `ThemeProvider` | ~2KB | Theme must wrap every page |
| `CartProvider` | ~3KB | Cart is used site-wide |
| `CryptoCurrencyProvider` | ~5KB | Crypto price display in footer/products; API fetch deferred 3s after mount |
| `CountryCurrencyProvider` | ~15KB | Currency display site-wide; reads cookie, defers exchange-rate fetch |
| `CriticalRoutePrefetcher` | ~1KB | Prefetches `/checkout`, `/products` |
| `AuthWalletModalProvider` | ~2KB | Event listener only; modal shell is dynamic |
| `WalletErrorBoundary` | ~1KB | Lightweight error boundary |

### What is NOT in the root layout (scoped to routes)

| Provider | Where it lives | Why |
|----------|----------------|-----|
| **WagmiProvider** (~200KB: wagmi + viem + chains) | `auth-wallet-modal-shell.tsx` (lazy, loads with modal) and `checkout/[invoiceId]/layout.tsx` | Only needed for wallet connect auth and crypto checkout |
| **NextSSRPlugin** (UploadThing) | `dashboard/layout.tsx` | File uploads only happen in dashboard |
| **SolanaWalletProvider** | `auth-wallet-modal-shell.tsx` and `checkout/[invoiceId]/layout.tsx` | Only needed for wallet auth and Solana payments |
| **SuiWalletProvider** | `checkout/[invoiceId]/layout.tsx` | Only needed for Sui payments |
| **MetaMaskProvider** | `checkout/[invoiceId]/layout.tsx` | Only needed for EVM payments |

**CRITICAL: Do not move WagmiProvider back into the root layout.** It adds ~200KB of client JS to every page. The wallet modal shell lazy-loads it when the user opens "Connect Wallet". The checkout invoice layout provides its own copy for crypto payments.

**Maintenance:**
- When adding a new heavy provider (wallet SDK, chart library, etc.), scope it to the route that needs it. Never add it to the root layout unless it is truly needed on every page.
- If a new auth method needs wagmi, add it inside the relevant dynamic shell, not globally.

---

## 3. Route prefetching

**File:** `src/ui/components/critical-route-prefetcher.tsx`

- **What:** A client component that runs once the app is interactive and prefetches critical routes with the Next.js router.
- **Routes prefetched:** `/checkout`, `/products`.
- **Where used:** Rendered in the root layout so these routes are prefetched soon after first paint, making the first click to checkout or products faster.

**Maintenance:** If you add another high-value route (e.g. a new shop or collection entry point), consider adding it to the prefetcher. Do not prefetch too many routes or you will waste bandwidth; keep it to a small set of primary navigation targets.

---

## 4. Streaming and Suspense (homepage)

**File:** `src/app/page.tsx`

The homepage uses React Suspense to stream above-the-fold content immediately:

- **Immediate (no data):** Hero section, brand statement, lookbook, "Why choose us", CTA — all render as HTML the moment the server starts responding.
- **Streamed (async server components):**
  - `StreamedCategoriesSection` — fetches categories API, streams into the page with a skeleton placeholder.
  - `StreamedFeaturedProducts` — fetches featured products API, streams with a product grid skeleton.
  - `StreamedTestimonials` — fetches reviews API, streams with a minimal placeholder.

Each streamed section is its own async function wrapped in `<Suspense fallback={<Skeleton />}>`. This means the hero is visible in the browser before any API call completes.

**Maintenance:**
- When adding a new data-dependent section to the homepage, create an async server component and wrap it in `<Suspense>` with a skeleton fallback. Do not add it to a shared `Promise.all` that blocks the entire page.
- Keep above-the-fold sections (hero, brand statement) free of async data so they stream immediately.

---

## 5. Code-splitting and lazy loading (site-wide)

Heavy or non–first-paint UI is loaded with `next/dynamic` (or equivalent) so it lives in separate chunks. Below is where this is used and how to preserve or extend it.

### 5.1 Layout and global UI

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Footer** | `conditional-footer.tsx` | Footer is not in the initial bundle. A sentinel is rendered; when the user scrolls to ~75% (IntersectionObserver), the Footer is loaded via `next/dynamic` (`LazyFooter`). |
| **Footer content** | `footer.tsx` | `FooterDogePeek` is dynamic with `ssr: false`. |
| **Support chat** | `support-chat-widget-wrapper.tsx` | Widget is dynamic; loading is deferred 10s after mount, then visibility is fetched and the widget chunk is loaded only if visible. Hidden on `/telegram`. |
| **Auth wallet modal** | `auth-wallet-modal-provider.tsx` | `AuthWalletModalShell` is dynamic; loads when the modal is opened or when `PRELOAD_AUTH_WALLET_MODAL` is fired (e.g. hover over header profile/wallet). The shell includes WagmiProvider + SolanaWalletProvider so wallet SDKs are only loaded when the modal opens. |

### 5.2 Header and navigation

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Header** | `header.tsx` | `Cart` and `NotificationsWidget` are dynamic with `ssr: false` so cart and notifications code are not in the main bundle. Categories fetch is deferred to hover/focus on the Shop nav item (not on mount). Notification preferences are cached in sessionStorage. |
| **Mobile nav** | `mobile-nav-sheet.tsx` | `Cart` and `FooterPreferencesModal` are dynamic; modal loads only when the user opens preferences. |

### 5.3 Home and marketing

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Home page** | `app/page.tsx` | `FeaturedProductsSection` and `TestimonialsSection` are loaded with `nextDynamic` with `ssr: true`. Both are below the fold and in separate chunks. Data sections use Suspense streaming (see section 4). |

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
| `/api/categories` (header mega menu) | User hovers/focuses the Shop nav item or opens mobile menu | `header.tsx` |
| `/api/user/notifications` (header bell) | On mount for logged-in users, then cached in `sessionStorage`. Bypasses cache on `NOTIFICATION_PREFS_UPDATED` event. | `header.tsx` |
| `/api/crypto/prices` | 3-second idle delay after mount; fallback rates render immediately | `use-crypto-currency.tsx` |
| `/api/geo` + exchange rates | On mount only if no cookie/localStorage cache; exchange rates cached 1 hour | `use-country-currency.tsx` |
| `/api/support-chat/widget-visible` | 10-second delay after mount | `support-chat-widget-wrapper.tsx` |

**Maintenance:**
- When adding a new API call to a global component (header, footer, provider), defer it unless it is needed for above-the-fold rendering.
- Use `sessionStorage` or `localStorage` to cache results that don't change within a session (like notification preferences, user country).
- Set short timeouts (5s) with `AbortController` so slow APIs don't block navigation.

---

## 7. Images

- **`next/image`** is used for product and marketing images; the runtime optimizes format and sizing.
- **Priority:** Images critical for LCP (e.g. hero, first few product tiles, auth pages) use `priority` so they are not lazy-loaded. Examples:
  - `products-client.tsx`: `priority={index < 4}` for the first four products.
  - `page.tsx` (homepage): Lookbook image uses `priority`. First 2 category images use `priority={index < 2}`.
  - Auth sign-in/sign-up and about page: hero/logo images use `priority`.
  - Product detail gallery: `priority={!selectedVariant?.id}` for the main image.
- **Product card** (`product-card.tsx`) accepts a `priority` prop and passes it to `next/image`; callers set it for above-the-fold items.
- **Sizes:** Use appropriate `sizes` where it improves layout and reduces unnecessary large loads.

**Maintenance:** For new high-impact images (e.g. new hero or first-screen product grid), set `priority` only for the few that affect LCP; leave the rest to default lazy loading.

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

- **Stripe SDK** (`@stripe/stripe-js`): Loaded lazily via dynamic `import()` in `StripeCardPayment.tsx` and `ExpressCheckout.tsx`. The SDK only downloads when the card form becomes visible (credit card selected) or when Express Checkout renders with `stripeEnabled` and a valid total. **Do not switch back to a top-level `import { loadStripe }` — this would download the Stripe SDK on every checkout page load.**
- **Wallet SDKs**: See Provider Scoping (section 2).

### Conditional wallet providers (invoice layout)

**File:** `src/app/checkout/[invoiceId]/layout.tsx`

The invoice layout loads wallet providers **conditionally** based on the payment type from the prefetched order:

- `paymentType === "eth"` → WagmiProvider + MetaMaskProvider
- `paymentType === "solana"` or empty → SolanaWalletProvider (includes WalletConnect adapter and MWA)
- `paymentType === "sui"` → SuiWalletProvider
- `paymentType === "btcpay"` or `"ton"` → No wallet providers needed
- Unknown (empty paymentType, before order loads) → All providers (fallback)

This keeps ~100-200KB of unused wallet SDK code out of the client for payment types that don't need them.

### Code-splitting

- Checkout page: `checkout-loader.tsx` loads `CheckoutClient` via `next/dynamic`; `CheckoutClient` loads `PaymentMethodSection` dynamically with a skeleton.
- Payment page: `crypto-pay-loader.tsx` dynamically imports CryptoPayClient, EthPayClient, BtcPayClient, TonPayClient and renders one based on `paymentType`.

### Earlier data

- Invoice layout wraps with `OrderPrefetchProvider`, which fetches the order once. The layout uses it for `paymentType` (to select providers and header); the loader uses it for `paymentType` and passes the same order as `initialOrder` to the pay client so they do not fetch again.

**Full checkout/payment detail:** See `src/app/checkout/README.md` for file locations, maintenance checklists, and how to add new payment methods or preserve prefetch/initialOrder behavior.

---

## 10. Maintenance checklist (when changing the app)

- [ ] **New heavy route or feature** – Prefer a loader + `next/dynamic` with a loading state; avoid putting large deps in the main or layout bundle.
- [ ] **New heavy provider** – Scope it to the route that needs it. Never add wagmi, wallet adapters, or similar SDKs to the root layout.
- [ ] **New payment method or pay client** – Add prefetch in `prefetch-checkout.ts` and call it from the handler that navigates to the payment page; support `initialOrder` in the pay client so the layout's order fetch is reused (see checkout README). Add conditional provider loading in the invoice layout.
- [ ] **Moved or renamed dynamically imported file** – Update all dynamic `import("...")` and any prefetch helpers that use the same path.
- [ ] **New above-the-fold image** – Set `priority` only for the few images that affect LCP.
- [ ] **New data section on homepage** – Wrap in `<Suspense>` with a skeleton fallback so the hero streams immediately.
- [ ] **New API call in header or global component** – Defer to interaction (hover, focus, menu open) or idle timeout. Do not fetch on mount.
- [ ] **New font or font weight** – Check if an existing font covers the use case. Keep Manrope weights minimal.
- [ ] **New high-value navigation target** – Consider adding it to `CriticalRoutePrefetcher` if it should feel instant on first click.
- [ ] **Bundle size** – After significant changes, run `bun run analyze` and confirm chunk boundaries and sizes are still acceptable.

---

## 11. Best practices

### Do

- **Scope providers to routes.** If a provider is only needed on 2-3 routes, put it in those route layouts, not the root layout.
- **Stream with Suspense.** For pages with multiple data fetches, use Suspense boundaries so above-the-fold content renders immediately.
- **Defer API calls.** Fetch on interaction (hover, focus, click) or after an idle timeout, not on mount.
- **Lazy-load third-party SDKs.** Use dynamic `import()` for Stripe, wallet SDKs, chat widgets, and similar. Only load when the user needs them.
- **Cache API results.** Use `sessionStorage` for results that don't change within a session (notification prefs, geo, exchange rates).
- **Set image `priority`.** Only for above-the-fold images that affect LCP. Use `sizes` to avoid downloading unnecessarily large images.
- **Use skeletons as Suspense fallbacks.** Match the layout of the final content so there is no layout shift when data arrives.
- **Run `bun run analyze` after big changes.** Check that new dependencies landed in the right chunks and didn't bloat the main bundle.

### Don't

- **Don't add WagmiProvider, SolanaWalletProvider, or similar to the root layout.** These add 100-250KB each to every page.
- **Don't call `loadStripe()` at module level or in a `useState` initializer** unless the Stripe form is guaranteed to be visible. Use `useEffect` with a dynamic `import()`.
- **Don't `await` all data before rendering a page.** Use Suspense streaming so the server sends HTML as data becomes available.
- **Don't fetch data on every navigation** if it doesn't change often. Cache in `sessionStorage` or a React context.
- **Don't add font weights that aren't used.** Each weight adds to the font download size.
- **Don't put `NextSSRPlugin` (UploadThing) in the root layout.** It only belongs in the dashboard where uploads happen.

---

## 12. Ideas for further improvement

- **More route prefetching:** If analytics show other routes (e.g. category or collection pages) as common first clicks, consider prefetching them in `CriticalRoutePrefetcher` or on hover/focus of nav links.
- **Checkout:** If you add a cart or session API, consider starting that request from the checkout layout or a small client component so data is in flight before CheckoutClient mounts.
- **Heavy components:** If any client (checkout, payment, dashboard, etc.) grows, consider splitting modals, tabs, or secondary UI with `next/dynamic` and keep the critical path minimal.
- **Support chat:** The 10s defer and visibility check could be tuned (e.g. by route or user segment) if you want the widget to load sooner on some pages.
- **Server-side crypto prices:** Move the crypto price fetch to a server component or API route with ISR so the client doesn't need to fetch at all on first render.
- **Partial prerendering:** When Next.js stabilizes PPR, consider enabling it for the homepage so the static shell (hero, brand statement) is served from the CDN edge while dynamic sections stream.
