# Speed optimization and lazy loading

This document describes how the webapp stays fast: build and server config, route prefetching, code-splitting and lazy loading across the site, image handling, and checkout/payment-specific optimizations. Use it to maintain and extend these patterns so they are not lost when making changes.

## Goals

- **Smaller initial JS** – Heavy or below-the-fold UI lives in separate chunks and loads only when needed or when the user shows intent.
- **Faster navigation** – Critical routes and checkout/payment chunks are prefetched so navigation often feels instant.
- **Efficient assets** – Compression, cache headers, optimized package imports, and image best practices reduce payload and improve repeat visits.
- **Single source of data where possible** – e.g. one order fetch on the payment page, shared by layout and pay clients.

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

## 2. Route prefetching

**File:** `src/ui/components/critical-route-prefetcher.tsx`

- **What:** A client component that runs once the app is interactive and prefetches critical routes with the Next.js router.
- **Routes prefetched:** `/checkout`, `/products`.
- **Where used:** Rendered in the root layout so these routes are prefetched soon after first paint, making the first click to checkout or products faster.

**Maintenance:** If you add another high-value route (e.g. a new shop or collection entry point), consider adding it to the prefetcher. Do not prefetch too many routes or you will waste bandwidth; keep it to a small set of primary navigation targets.

---

## 3. Code-splitting and lazy loading (site-wide)

Heavy or non–first-paint UI is loaded with `next/dynamic` (or equivalent) so it lives in separate chunks. Below is where this is used and how to preserve or extend it.

### 3.1 Layout and global UI

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Footer** | `conditional-footer.tsx` | Footer is not in the initial bundle. A sentinel is rendered; when the user scrolls to ~75% (IntersectionObserver), the Footer is loaded via `next/dynamic` (`LazyFooter`). |
| **Footer content** | `footer.tsx` | `FooterDogePeek` is dynamic with `ssr: false`. |
| **Support chat** | `support-chat-widget-wrapper.tsx` | Widget is dynamic; loading is deferred 10s after mount, then visibility is fetched and the widget chunk is loaded only if visible. Hidden on `/telegram`. |
| **Auth wallet modal** | `auth-wallet-modal-provider.tsx` | `AuthWalletModalShell` is dynamic; loads when the modal is opened or when `PRELOAD_AUTH_WALLET_MODAL` is fired (e.g. hover over header profile/wallet). |

### 3.2 Header and navigation

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Header** | `header.tsx` | `Cart` and `NotificationsWidget` are dynamic with `ssr: false` so cart and notifications code are not in the main bundle. |
| **Mobile nav** | `mobile-nav-sheet.tsx` | `Cart` and `FooterPreferencesModal` are dynamic; modal loads only when the user opens preferences. |

### 3.3 Home and marketing

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Home page** | `app/page.tsx` | `TestimonialsSection` (testimonials marquee) is loaded with `nextDynamic`, with a minimal loading placeholder and `ssr: true` so it can still be server-rendered for SEO. |

### 3.4 Products and catalog

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Featured products** | `FeaturedProductsSection.tsx` | `ProductQuickView` is dynamic with `ssr: false`; the quick-view modal and its deps load only when the user opens a product quick view. |
| **Related products** | `related-products-section.tsx` | Same: `ProductQuickView` is dynamic so the product detail modal is in its own chunk. |
| **Product listing** | `products-client.tsx` | Product grid images use `priority={index < 4}` for the first four items to improve LCP; rest load lazily. |

### 3.5 Dashboard and account

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Dashboard layout** | `sidebar-loader.tsx` | `DashboardSidebar` is dynamic with a skeleton; keeps dashboard sidebar in a separate chunk. |
| **Profile** | `profile-loader.tsx` | `ProfileViewClient` and `EditProfilePageClient` (edit page) are dynamic with skeletons. |
| **Security** | `security-loader.tsx` | Security page client is dynamic. |
| **Wishlist** | `wishlist-loader.tsx` | Wishlist client is dynamic. |
| **Uploads** | `dashboard/uploads/page.client.tsx` | Uploads page uses dynamic imports for heavy UI. |

### 3.6 Auth (login / signup)

| Area | Component / behavior | Notes |
|------|----------------------|--------|
| **Login** | `login-loader.tsx` | Login form/client is dynamic. |
| **Signup** | `signup-loader.tsx` | Signup form/client is dynamic. |

### 3.7 Other routes

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

## 4. Images

- **`next/image`** is used for product and marketing images; the runtime optimizes format and sizing.
- **Priority:** Images critical for LCP (e.g. hero, first few product tiles, auth pages) use `priority` so they are not lazy-loaded. Examples:
  - `products-client.tsx`: `priority={index < 4}` for the first four products.
  - Auth sign-in/sign-up and about page: hero/logo images use `priority`.
  - Product detail gallery: `priority={!selectedVariant?.id}` for the main image.
- **Product card** (`product-card.tsx`) accepts a `priority` prop and passes it to `next/image`; callers set it for above-the-fold items.
- **Sizes:** Use appropriate `sizes` where it improves layout and reduces unnecessary large loads.

**Maintenance:** For new high-impact images (e.g. new hero or first-screen product grid), set `priority` only for the few that affect LCP; leave the rest to default lazy loading.

---

## 5. Checkout and payment (summary)

Checkout and payment routes use **prefetch-on-intent**, **code-splitting**, and **earlier data loading** so the first interaction (open cart, go to checkout, choose payment, land on payment page) feels fast.

- **Prefetch on intent**
  - **Checkout chunk:** Prefetched when the cart opens or when the user hovers/focuses the “Checkout” link (in `cart-client.tsx` and `prefetch-checkout.ts`).
  - **Payment client chunks:** Prefetched when the user selects a payment method that goes to `/checkout/[invoiceId]` (in `PaymentMethodSection.tsx`: e.g. `prefetchCryptoPayClient()`, `prefetchBtcPayClient()`, etc.).
- **Lazy loading**
  - Checkout page: `checkout-loader.tsx` loads `CheckoutClient` via `next/dynamic`; `CheckoutClient` loads `PaymentMethodSection` dynamically with a skeleton.
  - Payment page: `crypto-pay-loader.tsx` dynamically imports CryptoPayClient, EthPayClient, BtcPayClient, TonPayClient and renders one based on `paymentType`.
- **Earlier data**
  - Invoice layout wraps with `OrderPrefetchProvider`, which fetches the order once. The layout uses it for `isEvm`; the loader uses it for `paymentType` and passes the same order as `initialOrder` to the pay client so they do not fetch again.

**Full checkout/payment detail:** See `src/app/checkout/README.md` (section “Speed optimizations and lazy loading”) for file locations, maintenance checklists, and how to add new payment methods or preserve prefetch/initialOrder behavior.

---

## 6. Maintenance checklist (when changing the app)

- [ ] **New heavy route or feature** – Prefer a loader + `next/dynamic` with a loading state; avoid putting large deps in the main or layout bundle.
- [ ] **New payment method or pay client** – Add prefetch in `prefetch-checkout.ts` and call it from the handler that navigates to the payment page; support `initialOrder` in the pay client so the layout’s order fetch is reused (see checkout README).
- [ ] **Moved or renamed dynamically imported file** – Update all dynamic `import("...")` and any prefetch helpers that use the same path.
- [ ] **New above-the-fold image** – Set `priority` only for the few images that affect LCP.
- [ ] **New high-value navigation target** – Consider adding it to `CriticalRoutePrefetcher` if it should feel instant on first click.
- [ ] **Bundle size** – After significant changes, run `bun run analyze` and confirm chunk boundaries and sizes are still acceptable.

---

## 7. Ideas for further improvement

- **More route prefetching:** If analytics show other routes (e.g. category or collection pages) as common first clicks, consider prefetching them in `CriticalRoutePrefetcher` or on hover/focus of nav links.
- **Checkout:** If you add a cart or session API, consider starting that request from the checkout layout or a small client component so data is in flight before CheckoutClient mounts.
- **Heavy components:** If any client (checkout, payment, dashboard, etc.) grows, consider splitting modals, tabs, or secondary UI with `next/dynamic` and keep the critical path minimal.
- **Support chat:** The 10s defer and visibility check could be tuned (e.g. by route or user segment) if you want the widget to load sooner on some pages.
