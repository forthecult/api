# Seed data for production/staging

Deterministic data used when seeding the database (e.g. `db:seed:production`, `db:seed:staging`).

- **`shipping-rules.ts`** — Shipping options by brand slug. Used by `seed-shipping-by-brand.ts`. Add overrides in `BRAND_SHIPPING_OVERRIDES`; all other brands get `DEFAULT_SHIPPING_OPTIONS` (US $3, International $8).
