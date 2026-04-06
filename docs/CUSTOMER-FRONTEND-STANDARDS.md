# Customer Front-End Standards & Performance

Standards and best practices for the customer-facing storefront (non-dashboard) to keep the site fast, consistent, and maintainable.

## Layout & structure

- **Container**: Use `PageContainer` from `~/ui/components/layout/page-container` for all customer page content. It provides `container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`.
- **Sections**: Use `PageSection` for consistent vertical rhythm and optional `background="muted"`. Use `SectionHeading` or `SectionHeadingBlock` for title + subtitle so styles stay consistent.

## Loading states

- **Full-page fallback**: Use `PageLoadingFallback` from `~/ui/primitives/spinner` as the `Suspense` fallback for route-level loading (e.g. products, category slug).
- **Inline spinner**: Use `<Spinner variant="page" />` for section-level loading (e.g. product grid loading). Use `<Spinner variant="inline" />` for buttons/small UI. Do not duplicate inline spinner markup.

## URLs

- **Server-side fetch base URL**: Use `getServerBaseUrl()` from `~/lib/app-url` (e.g. for `fetch(`${getServerBaseUrl()}/api/...`)` in RSC).
- **Public site URL (canonical, metadata)**: Use `getPublicSiteUrl()` from `~/lib/app-url` for sitemaps, canonical links, and Open Graph.

## Auth pages (login / signup)

- Use `AuthFormLayout`, `AuthFormHeader`, `AuthFormDivider` from `~/ui/components/auth/auth-form-layout`.
- Use `AuthPageSkeleton` as the dynamic loader skeleton for both login and signup so the layout is shared and consistent.

## Performance

- **Heavy client components**: Lazy-load with `next/dynamic` and a clear loading state (e.g. support chat widget, auth page clients).
- **Support chat**: The support chat widget is loaded 10 seconds after the page loads, then the visibility API is checked and the widget is dynamically imported. This keeps the main bundle and initial requests lighter.
- **Images**: Use Next.js `Image` with `sizes` and `priority` for above-the-fold hero images. Prefer AVIF/WebP (configured in `next.config.ts`).
- **Package imports**: `optimizePackageImports` in `next.config.ts` is used for lucide-react, Radix, framer-motion, date-fns; add new large UI/icon libs there when introduced.

## Duplications to avoid

- In **server / internal code**, do not repeat ad-hoc `process.env.*` URL chains; use `getServerBaseUrl()` from `~/lib/app-url`. Never expose env var **names** or values in customer-facing UI or API responses (see `docs/SECURITY-DEVELOPMENT-STANDARDS.md`).
- Do not repeat long container/section class strings; use `PageContainer` / `PageSection`.
- Do not add new one-off spinner markup; use `Spinner` or `PageLoadingFallback`.

## Security (customer-visible surfaces)

- Follow **`docs/SECURITY-DEVELOPMENT-STANDARDS.md`**: environment variable names, hosting/deployment details, and internal configuration must **not** appear in user-visible copy, toasts, or JSON error messages returned to the browser (including dashboard and chat).
- The “Duplications to avoid” note above about `getServerBaseUrl()` applies to **implementation in code** only—never surface raw `process.env` names or values to customers or vendors.
