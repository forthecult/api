# Printful API Integration

Printful is treated as a **vendor**: they provide products (different brands and variants). Our products use the **same schema** whether manual or from Printful—no separate tables. Order of work: **products → shipping → orders**; same approach is used for Printify.

## Sync Product Support

We support **bidirectional synchronization** with Printful Sync Products:

- **Sync Products** are "finished" products in your Printful store—blank catalog items with your designs already applied
- Products created in the Printful dashboard are automatically synced to your backend via webhooks
- Prices can be pushed back from your backend to Printful (retail_price on variants)

### How It Works

1. **Create products in Printful** dashboard (add designs to blank products)
2. **Sync to backend** via webhook (automatic) or admin API (manual)
3. **Edit prices** in your admin panel
4. **Push prices back** to Printful if desired

### Schema Fields

- `product.printfulSyncProductId` — Printful sync_product.id for bidirectional sync
- `product_variant.printfulSyncVariantId` — Printful sync_variant.id for variant sync
- `product.lastSyncedAt` — When product was last synced

### API Endpoints

```bash
# List local Printful products
GET /api/admin/printful/products

# List available products from Printful API
GET /api/admin/printful/products?source=api

# Import all products from Printful
POST /api/admin/printful/sync
{ "action": "import_all" }

# Import a single product
POST /api/admin/printful/sync
{ "action": "import_single", "printfulSyncProductId": 123 }

# Push price changes to Printful
POST /api/admin/printful/sync
{ "action": "export_single", "productId": "abc" }
```

### Webhooks and re-synchronization

Product sync events are handled automatically:
- `product_synced` — New product created/synced in Printful → imported to backend
- `product_updated` — Product updated in Printful → **re-imports** that product into the backend (full sync). This includes:
  - **Inventory / availability**: When Printful marks a variant as out of stock (`availability_status`), we update the local variant’s `availability_status` so the storefront can show “Out of stock” or hide the option.
  - **Shipping and product data**: Any changes to the sync product or variants (name, price, thumbnail, etc.) are reflected in our DB after the webhook runs.
- `product_deleted` — Product deleted in Printful → unpublishes local product

So **re-synchronization from Printful → our system happens automatically** when Printful sends `product_updated` (e.g. after inventory or shipping updates). No separate polling is required.

**Register the webhook** with Printful: Configure your webhook URL via the Printful API (see [developers.printful.com](https://developers.printful.com/)) or dashboard. URL: `https://your-store.com/api/webhooks/printful`. Set `PRINTFUL_WEBHOOK_SECRET` in .env to the secret Printful provides so we can verify signatures (HMAC-SHA256).

**Local development:** Printful cannot POST to localhost, so webhooks won’t fire when running locally. Use the manual sync below to pull products.

### Product not showing in store?

1. **Webhooks need a public URL** — When running locally, webhooks can’t reach your app. Products sync automatically only when the app is deployed at a URL Printful can call.

2. **Manual sync** — Pull all synced products from Printful into the store:
   ```bash
   bun run printful:sync
   ```
   Or call the admin API: `POST /api/admin/printful/sync` with body `{ "action": "import_all" }`. This imports new products only; existing ones are skipped.

3. **Full re-sync (update existing products)** — To refresh Markets, mockup images, and other data for products already in the store:
   ```bash
   bun run printful:resync
   ```
   Or call the admin API: `POST /api/admin/printful/sync` with body `{ "action": "import_all", "overwrite": true }`. You must be logged in as an admin (session cookie). Re-sync overwrites local product data with Printful’s (name, images, variants, **shipping countries/Markets**, etc.).

4. **Product must be synced in Printful** — In the Printful dashboard, the product must be in “Synced” status (not draft or failed). Our import only pulls products that are synced.

## Product schema alignment

Our product and variant fields align with Printful so we don't need unique table elements. Same schema for all products (manual, Printful, Printify). Examples:

- **Product**: brand, description, title (name), category, SEO (slug, metaDescription), image, price (default/min), weight, source, externalId (Printful: catalog_product_id), printfulSyncProductId.
- **Variant** (product_variants table): size, color, quantity/stock, price, SKU, **label** (Printful sync variant “name”, e.g. “Product / Color / Size”), externalId (Printful: catalog_variant_id), printfulSyncVariantId, weight, image, **imageAlt**, **imageTitle** (SEO), **availabilityStatus** (e.g. in_stock, out_of_stock; synced on product_updated).
- **Size guide**: stored on product (e.g. sizeGuideJson from Printful GET catalog-products/{id}/sizes).
- **Shipping time**: per order/shipment from Printful; we can show estimates when we have them.
- **Shipping countries (Markets)**: On import we call Catalog v2 `GET /catalog-products/{id}/shipping-countries` when we have a catalog product ID; if it returns a list of country codes we populate `product_available_country` so the admin **Markets** section and the **shipping calculator** know where the product ships. If the endpoint is unavailable or returns nothing we use a comprehensive fallback list (see `pod-shipping-countries.ts`) so Markets are populated; we still exclude no-ship countries. **Admin Markets**: When you edit a product in admin and use the "Markets" section (country checkboxes), saving sends `availableCountryCodes` to the backend and overwrites the product’s allowed countries. Leave all unchecked for "available everywhere". The shipping calculator uses this table to decide if we can ship to the selected country and to request Printful rates; if no countries are stored, the product is treated as available everywhere.

Sync pulls from Printful into this schema. You create the product in Printful, then it syncs to the store. Data is mapped to match our backend product/variant variables (description, title, price, etc.).

## Sync flow (products)

- **Printful → backend**: Sync products from your Printful store → creates **one Product** + **many ProductVariants** in our DB. Includes description, title, brand, variants (size, color, price). Re-sync updates that product and its variants from Printful.
- **Backend → Printful**: When you save a product in the admin, we push **name, thumbnail, variant retail_price, variant SKU** to Printful for that product (if it’s a Printful sync product). Description/tags are not supported by Printful’s Sync Products API and remain DB-only.
- **Multiple designs**: The same Printful catalog product (e.g. one t-shirt) can be created multiple times in Printful with different designs—each becomes a separate sync product and a separate product in our backend.

## Checkout: email and phone

- **Printful**: Recipient supports `name`, `address1`, `city`, `state_code`, `country_code`, `zip`, and optionally `phone`, `email`. Email and phone are **not** required by Printful for order creation.
- **Our checkout**: We do **not** need to make email or phone mandatory for customers. We can send them to Printful when provided and leave them optional in our form.

## Order status (customer-facing)

- When we send an order to Printful, we show the customer **pending** or **awaiting shipment**.
- We **do not** pass every Printful status through to the customer. Only expose what's relevant (e.g. **partial shipment**, **shipped**).
- For things like refund, delay, or fulfillment issues, we may contact the customer first and **manually update** the status in our system after that—rather than auto-syncing as soon as Printful changes status.

## Shipping and shipping calculator

- For orders that include Printful items, we take **Printful's shipping rates** as the base.
- **Shipping calculator** needs each Printful item’s **catalog variant ID** (stored in variant `externalId`). If the cart sends only a product ID (no variant), or the variant has no `externalId`, we use the product’s first variant so a rate can still be returned. Ensure products are synced so variants have `externalId` set.
- **$0 or no rate**: Check that the product has at least one variant with `externalId` (catalog_variant_id), that the shipping country is in the product’s allowed countries (or leave Markets “available everywhere”), and that the request includes a valid `countryCode` (and `stateCode` for US/CA).
- We then apply **our rules** on top: e.g. free shipping over $100, reduced shipping, or extra shipping on top of Printful's rate. So: Printful rates + our modifiers before showing options to the customer.

## Orders (summary)

- **Our schema**: `ordersTable` has shipping fields, `status`, `printfulOrderId`. Order items have `productId` and optional `productVariantId` (for Printful we use variant's `externalId` = catalog_variant_id when sending to Printful).
- **Flow**: After payment (Stripe/Solana Pay), create draft in Printful with our order id as `external_id`, recipient from our shipping fields, line items with `catalog_variant_id` from product variant's `externalId`. Then confirm. Store Printful order id in `printfulOrderId`.
- **Webhooks**: Handle `order_updated`, `shipment_sent`, etc. Update our DB for internal use; map to customer-facing status as above (don't auto-expose refund/delay; manual update after customer contact when needed).

## Environment

- `PRINTFUL_API_TOKEN` – Private token for API v2 (Bearer). Required for catalog, shipping, and orders.
- Optional: `PRINTFUL_STORE_ID` – If you have multiple stores, set this to the store’s numeric ID so product export (admin → Printful), sync, and **shipping rate calculation at checkout** use the correct store. Sent as `X-PF-Store-Id` on Sync Products and Shipping Rates API requests. If shipping always shows $0 at checkout and you use multiple stores, set this.

**If sync or shipping fails with “printful_sync_variant_id” or “column does not exist”:** the `product_variant` table must have the Printful/Printify sync columns. Run: `bun run db:migrate-printful-printify-sync` (or `psql $DATABASE_URL -f scripts/migrate-printful-printify-sync.sql` then `scripts/migrate-variant-composite-unique.sql`), then re-sync products from Printful.
- `PRINTFUL_WEBHOOK_SECRET` – Secret for verifying Printful webhook signatures (from Printful dashboard when registering webhook URL).

If **admin changes don’t appear in Printful** after save: the app pushes name, thumbnail, and variant prices/SKU to Printful when you save a Printful product. If the push fails, the admin UI shows “Product saved, but changes were not pushed to Printful: &lt;error&gt;”. Check that `PRINTFUL_API_TOKEN` is valid, and if you use multiple stores, set `PRINTFUL_STORE_ID`. Common API errors (e.g. invalid thumbnail URL format) will appear in that message.

## Files

- **Schema**: `productsTable` (printfulSyncProductId, lastSyncedAt; externalId = catalog_product_id), `productVariantsTable` (printfulSyncVariantId, externalId = catalog_variant_id), `ordersTable.printfulOrderId`.
- **Lib**: 
  - `src/lib/printful.ts` – API client for catalog, shipping-rates, orders, and sync products
  - `src/lib/printful-sync.ts` – Bidirectional product synchronization service
  - `src/lib/printful-orders.ts` – Order management (create, cancel, webhooks)
- **API**: 
  - `POST /api/admin/printful/sync` – Product sync actions
  - `GET /api/admin/printful/products` – List Printful products
  - `POST /api/webhooks/printful` – Webhook handler for order and product events

## Implementation order

1. **Products** – Sync products from Printful store (sync products with your designs); re-sync updates existing product/variants. Price changes can be pushed back.
2. **Shipping** – Call Printful shipping-rates, then apply our rules (free over $X, reduced, or add-on).
3. **Orders** – Send to Printful on payment confirm; webhook handler updates our DB; customer-facing status = pending / awaiting shipment / partial / shipped (others handled manually when needed).
4. **Custom designs (later)** – Order items with `placements`; align with Printful design API when we add this.
