# Culture — webapp

The Next.js application for the Culture storefront (`forthecult.store`). Lives in `webapp/` inside the Culture monorepo.

> Culture is a lifestyle brand. Crypto is a means, not the identity. Read [docs/CULTURE-BRAND-GUIDE.md](docs/CULTURE-BRAND-GUIDE.md) before writing customer-facing copy.

## What's here

- Storefront, product detail, checkout (multi-rail: card, Solana Pay, Ethereum, Sui, etc.).
- Admin surfaces under `src/app/admin/` and `src/app/api/admin/`.
- Shared database schema and Drizzle config for the whole monorepo under `src/db/` and [drizzle.config.ts](drizzle.config.ts).
- Email templates (Resend + React Email) under `src/emails/`.
- Playwright smoke tests under `e2e/`.

## Prerequisites

- [Bun](https://bun.sh) (package manager and runtime for scripts).
- Node.js 20+ (for tools that don't run under Bun).
- Postgres 16+ (local Docker or a managed instance; the schema is shared across the monorepo).

## Local dev

```bash
bun install
cp .env.example .env
# fill in DATABASE_URL and any service keys you need

bun db:push   # apply Drizzle schema
bun run dev   # Next.js on http://localhost:3000
```

### Local Postgres quick-start

```bash
docker run -d --name cult-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cult \
  -p 5432:5432 postgres:16

# then in .env:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cult
```

## Verification

From `webapp/`:

```bash
bun run check        # tsc --noEmit + eslint --fix + biome check --fix + knip
bun run typecheck    # typecheck only
bun run smoketest    # Playwright smoke tests (builds first in CI)
```

Full repo-wide verification guidance: [.cursor/skills/repo-workflow/SKILL.md](../.cursor/skills/repo-workflow/SKILL.md).

## Database

The Postgres instance is shared across the monorepo. Schema and migrations live only here.

- Architecture: [.cursor/skills/drizzle-database/SKILL.md](../.cursor/skills/drizzle-database/SKILL.md)
- Commands and workflow: [.cursor/skills/db-conventions/SKILL.md](../.cursor/skills/db-conventions/SKILL.md)
- Row-level security: [docs/RLS-TABLES.md](docs/RLS-TABLES.md)

Do not create an additional Postgres or Drizzle client anywhere else in the monorepo. Other apps read via a typed API layer.

## Security

- Monorepo-wide operator runbook: [../SECURITY.md](../SECURITY.md)
- Customer-surface and public-docs policy: [docs/SECURITY-DEVELOPMENT-STANDARDS.md](docs/SECURITY-DEVELOPMENT-STANDARDS.md)
- Secrets rules (code and CI): [.cursor/rules/no-hardcoded-secrets.mdc](../.cursor/rules/no-hardcoded-secrets.mdc), [.cursor/rules/ci-and-secrets.mdc](../.cursor/rules/ci-and-secrets.mdc)

Never hardcode a secret, never name an internal env var in customer-facing UI or docs, and never surface a vendor name on a public API path.

## Brand and voice

- Direction and visual system: [docs/CULTURE-BRAND-GUIDE.md](docs/CULTURE-BRAND-GUIDE.md)
- Strategy and audience: [docs/CULTURE-BRAND-VISION.md](docs/CULTURE-BRAND-VISION.md)
- Internal training supplement: [docs/Culture-Bible.md](docs/Culture-Bible.md)
- Open contradictions across the above: [docs/BRAND-RECONCILIATION.md](docs/BRAND-RECONCILIATION.md)

## Engineering conventions

- Monorepo layout and values: [.cursor/skills/code-standards/SKILL.md](../.cursor/skills/code-standards/SKILL.md)
- TypeScript style: [.cursor/skills/ts-conventions/SKILL.md](../.cursor/skills/ts-conventions/SKILL.md) and [.cursor/rules/typescript-strictness.mdc](../.cursor/rules/typescript-strictness.mdc)
- UI direction: [.cursor/skills/frontend-design/SKILL.md](../.cursor/skills/frontend-design/SKILL.md)
- Performance: [.cursor/rules/performance.mdc](../.cursor/rules/performance.mdc)
- Naming (camelCase TS, snake_case DB): [.cursor/rules/naming-conventions.mdc](../.cursor/rules/naming-conventions.mdc)

## Scope

`webapp/` owns: storefront, admin, shared database, email, customer-facing API.

It does not own: on-chain contracts (`contracts/`), the mobile app (`solanamobile/`), agent workspaces (`openclaw/`), or API docs (`api/`). See [.cursor/skills/code-standards/SKILL.md](../.cursor/skills/code-standards/SKILL.md) for the full map.
