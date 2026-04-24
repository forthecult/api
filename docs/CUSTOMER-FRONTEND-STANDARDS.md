# Customer Front-End Standards & Performance

Standards and best practices for the customer-facing storefront (non-dashboard) to keep the site fast, consistent, and maintainable.

## Design posture

The storefront should feel **modern, crafted, and quietly future-facing** — not generic, not a template, never "AI-demo" chrome. Canonical direction: [`CULTURE-BRAND-GUIDE.md`](CULTURE-BRAND-GUIDE.md) and the [`frontend-design` skill](../../.cursor/skills/frontend-design/SKILL.md). Every surface we ship is a conversion surface; design quality is measured, not just admired — see [`docs/operations/DATA-DRIVEN.md`](../../docs/operations/DATA-DRIVEN.md).

Performance is part of that feeling: a fast, zero-jank site looks more premium than a slow one no matter how pretty the mock was.

## Layout & structure

- **Container**: Use `PageContainer` from `~/ui/components/layout/page-container` for all customer page content. It provides `container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`.
- **Sections**: Use `PageSection` for consistent vertical rhythm and optional `background="muted"`. Use `SectionHeading` or `SectionHeadingBlock` for title + subtitle so styles stay consistent.

## Typography and legibility

- **Body copy ≥ 16px (1rem). Interactive text (buttons, links, labels, nav, pills, prices) ≥ 14px (0.875rem). Prices always ≥ 16px.** Below those floors is not acceptable — see the legibility floor in [`CULTURE-BRAND-GUIDE.md` → Typography](CULTURE-BRAND-GUIDE.md#legibility-floor-non-negotiable). If copy does not fit, shorten the copy or rework the layout — never shrink the font.
- **Line-height ≥ 1.5** for prose; ≥ 1.3 for headings. Keep `max-w-prose` (or 680px) on long text blocks.
- **Contrast:** ≥ 4.5:1 for normal text, ≥ 3:1 for large text. Test in both light (Parchment) and dark (Obsidian) modes — Smoke on Parchment is near the floor and needs review.
- **Tap targets ≥ 44×44px** on all interactive elements; icon-only controls get an accessible label.
- **No tiny legal footnote styling for anything the customer needs to read to make a decision** (pricing, shipping time, returns window, variant availability).

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

## Dependencies (fewer is better)

- **Open source first.** When we pick a library, the default is a permissively-licensed open-source project with active maintenance. Treat proprietary SDKs as a last resort — we call that out in PR review and document the reason in the PR description.
- **Privacy-minimizing by choice.** We prefer self-hosted or first-party over third-party SaaS where the difference is meaningful to customers, and we never pull in a library that phones home with customer identifiers. Analytics flows through our `/ingest/*` reverse proxy by design (see [`DATA-DRIVEN.md`](../../docs/operations/DATA-DRIVEN.md)).
- **Fewer libraries, smaller surface.** Before adding a dependency, check whether the platform or an existing dep already does it. Weigh bundle impact (check `optimizePackageImports`), maintenance load, and the additional supply-chain surface. A dependency added is a commitment to keep it patched.
- **Smaller alternatives.** `clsx` over `classnames`. Native `Intl.NumberFormat` over a currency formatting lib. Native `URL` / `URLSearchParams` over a query-string parser. Node / Web APIs over polyfilled wrappers when target support is there.
- **Run `knip` periodically** to flush dependencies whose last user got refactored out. A lib that nothing imports is still a security surface.

## Duplications to avoid

- In **server / internal code**, do not repeat ad-hoc `process.env.*` URL chains; use `getServerBaseUrl()` from `~/lib/app-url`. Never expose env var **names** or values in customer-facing UI or API responses (see `docs/SECURITY-DEVELOPMENT-STANDARDS.md`).
- Do not repeat long container/section class strings; use `PageContainer` / `PageSection`.
- Do not add new one-off spinner markup; use `Spinner` or `PageLoadingFallback`.

## Security (customer-visible surfaces)

- Follow **`docs/SECURITY-DEVELOPMENT-STANDARDS.md`**: environment variable names, hosting/deployment details, and internal configuration must **not** appear in user-visible copy, toasts, or JSON error messages returned to the browser (including dashboard and chat).
- The “Duplications to avoid” note above about `getServerBaseUrl()` applies to **implementation in code** only—never surface raw `process.env` names or values to customers or vendors.
