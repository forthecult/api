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
- **Support chat**: The support chat widget is loaded only after the visibility API returns and is dynamically imported to keep it out of the main bundle.
- **Images**: Use Next.js `Image` with `sizes` and `priority` for above-the-fold hero images. Prefer AVIF/WebP (configured in `next.config.ts`).
- **Package imports**: `optimizePackageImports` in `next.config.ts` is used for lucide-react, Radix, framer-motion, date-fns; add new large UI/icon libs there when introduced.

## Duplications to avoid

- Do not repeat `process.env.NEXT_SERVER_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"`; use `getServerBaseUrl()`.
- Do not repeat long container/section class strings; use `PageContainer` / `PageSection`.
- Do not add new one-off spinner markup; use `Spinner` or `PageLoadingFallback`.
