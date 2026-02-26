# 🏬 ftc • next.js ecommerce starter

[demo](https://ftc.com) — [sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/Pb8uKbwpsJ) — [github](https://github.com/blefnk/ftc) — [docs](https://deepwiki.com/blefnk/ftc-nextjs-template)

> **ftc** is a robust ecommerce template built with next.js and other modern technologies. it's designed for developers who want a fast, modern, and scalable foundation without reinventing the backend.

## stack

1. 🧱 **core**: [nextjs 15.3](https://nextjs.org) + [react 19.1](https://react.dev) + [ts 5.8](https://typescriptlang.org)
2. 🎨 **ui**: [tailwind 4.1](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
3. 🔒 **auth**: [better-auth](https://better-auth.com)
4. 🎬 **anims**: [animejs](https://animejs.com)
5. 📦 **storage**: [uploadthing](https://uploadthing.com)
6. 📊 **analytics**: [vercel](https://vercel.com/docs/analytics)
7. 🧬 **db**: [drizzle-orm](https://orm.drizzle.team) ([pg](https://neon.tech/postgresql/tutorial)) + [neon](https://neon.tech)/(🤔🔜)[supabase](https://supabase.com)
8. 🏗️ **dx**: [eslint](https://eslint.org) + [biome](https://biomejs.dev) + [knip](https://knip.dev)
9. 📝 **forms**: [react-form](https://tanstack.com/form) _(🔜 w.i.p)_ + [arktype](https://arktype.io)
10. 📅 **tables**: [react-table](https://tanstack.com/table)
11. 🌐 **i18n**: [next-intl](https://next-intl.dev) _(🔜 w.i.p)_
12. 💌 **email**: [resend](https://resend.com) _(🔜 w.i.p)_
13. 💳 **payments**: subscription provider (see billing integration below)
14. 🔑 **api**: [orpc](https://orpc.unnoq.com) _(🔜 w.i.p)_

> these features define the main reliverse stack. for an alternative setup—featuring clerk, stripe, trpc, and more—check out [versator](https://github.com/blefnk/versator).

## quick start

1. install [git](https://git-scm.com), [node.js](https://nodejs.org), [bun](https://bun.sh).
2. run:

   ```bash
   git clone https://github.com/blefnk/ftc.git
   cd ftc
   bun install
   copy .env.example .env
   ```

3. fill in the required environment variables in the `.env` file.
4. optionally, edit the `src/app.ts` file to make the app yours.
5. run:

   ```bash
   bun db:push # populate db with schema
   bun dev # start development server
   bun run build # build production version
   ```

6. edit something in the code manually or ask ai to help you.
7. done. seriously. you're building now.

### local database (Postgres)

The app requires Postgres. If you see **ECONNREFUSED** or **GET / 500** when running `bun dev`, the database is not running or not reachable.

- **Start Postgres** (pick one):
  - **Docker:** `docker run -d --name ftc-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ftc -p 5432:5432 postgres:16`
  - **System:** start the Postgres service (e.g. `sudo systemctl start postgresql`), then create the DB: `createdb ftc` (or `psql -c "CREATE DATABASE ftc;"`).
- Set `DATABASE_URL` in `.env` (e.g. `postgresql://postgres:postgres@localhost:5432/ftc`).
- From the repo root: `bun db:push` (creates tables), then `bun dev`.

**Production:** If you see **Max client connections** or **Failed query** (e.g. on product pages), your DB connection limit is being exceeded. Set `DATABASE_POOL_SIZE` to a lower value (e.g. `3` or `5`) so that (number of server workers × pool size) stays under your database’s connection limit. Using a connection pooler (e.g. your host’s pooled connection string) is recommended.

<!-- 
2. run:
   ```bash
   bun i -g @reliverse/cli
   reliverse cli
   ```
3. select **"create a new project"**.
4. follow prompts to configure your store.
-->

### commands

| command               | description                                    |
|-----------------------|------------------------------------------------|
| `bun dev`             | start local development                        |
| `bun build`           | create a production build                      |
| `bun latest`          | install latest deps                            |
| `bun ui`              | add shadcn components                          |
| `bun db:push`         | apply db schema changes                        |
| `bun db:auth`         | regenerate auth schema from better-auth config (then run `db:push` to sync DB) |
| `bun db:studio`       | open visual db editor                          |
| `bun db:seed:staging` | seed categories, brands, shipping-by-brand, products, reviews |

### seeding staging / deployed database

After deploying (e.g. Vercel, Railway) and creating a **staging** (or production) Postgres DB:

1. **Point env at the staging DB**  
   Set `DATABASE_URL` to your staging database connection string (in `.env` locally or in the host’s env vars).

2. **Apply schema** (once per DB, or after schema changes):
   ```bash
   bun run db:push
   ```

3. **Seed data** (categories → brands → shipping-by-brand → products → reviews):
   ```bash
   bun run db:seed:staging
   ```
   Run this from your machine with `DATABASE_URL` set to the staging DB, or from CI (e.g. a deploy script or GitHub Action that has access to `DATABASE_URL`). Reviews are seeded from **data/reviews-seed.json** (JSON; generate with `bun run db:extract-reviews` from `data/reviews.csv` and commit the file). Reviews are always seeded even when the product they reference doesn't exist yet (they can sync when the product is created).

To seed only categories and products (no brands): `bun run db:seed:all`.  
To run seeds individually: `bun run db:seed-categories`, `bun run db:seed-brands`, `bun run db:seed-shipping-by-brand`, `bun run db:seed`, `bun run db:seed-reviews`.

## Subscription / billing integration

ftc integrates with a subscription provider for payment processing and subscription management.

### features

- checkout flow for subscription purchases
- customer portal for managing subscriptions
- webhook handling for subscription events
- automatic customer creation on signup
- integration with better-auth for seamless authentication

### setup instructions

1. create an account with your chosen subscription provider and create an organization.
2. obtain an organization access token and webhook secret from the provider dashboard.
3. configure your environment variables in `.env` (use the variable names required by your provider).
4. create products in the subscription dashboard.
5. update the product IDs in `src/lib/auth.ts` to match your subscription products:
   ```typescript
   checkout: {
     enabled: true,
     products: [
       {
         productId: "your-product-id", // Replace with actual product ID from your subscription dashboard
         slug: "pro" // Custom slug for easy reference in Checkout URL
       }
     ]
   }
   ```
6. run `bun db:push` to create the necessary database tables
7. start the application with `bun dev`

### verification

to verify that the integration is working:

1. sign up for an account
2. navigate to the dashboard billing page (`/dashboard/billing`)
3. try subscribing to a plan
4. check that your subscription appears in the billing dashboard
5. test the customer portal by clicking "manage subscription"

### api routes

the following api routes are available for payment processing:

- `/api/payments/customer-state` - get the current customer state
- `/api/payments/subscriptions` - get user subscriptions

## address validation (loqate)

checkout shipping uses [loqate](https://www.loqate.com) for address autocomplete and validation. optional: add to `.env`:

```
LOQATE_API_KEY="your_loqate_key"
```

get a key at [loqate.com](https://www.loqate.com) (14-day free trial). if not set, the address field works as a plain text input.

## notes

- ftc 1.4.0+ is ai-ready — optimized for ai-powered ides like cursor, making onboarding effortless even for beginners.
- version 1.3.0 evolved into versator, featuring [clerk](https://clerk.com) authentication and [stripe](https://stripe.com) payments. explore [versator demo](https://versator.ftc.com/en), [repo](https://github.com/blefnk/versator), or [docs](https://docs.reliverse.org/versator).

## stand with reliverse

- ⭐ [star the repo](https://github.com/blefnk/ftc) to help the reliverse community grow.
- 😉 follow this project's author, [nazar kornienko](https://github.com/blefnk) and his [reliverse](https://github.com/reliverse) ecosystem, to get updates about new projects faster.
- 🦄 [become a sponsor](https://github.com/sponsors/blefnk) and power the next wave of tools that _just feel right_.

> every bit of support helps keep the dream alive: dev tools that don't suck.

## license

mit © 2025 [nazar kornienko (blefnk)](https://github.com/blefnk), [reliverse](https://github.com/reliverse)
