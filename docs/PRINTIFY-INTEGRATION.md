# Printify API Integration

Printify is treated as a **vendor** alongside Printful. Products use the **same schema** whether manual, Printful, or Printify—no separate tables. The integration follows the same patterns as Printful.

## Sync Product Support

We support **bidirectional synchronization** with Printify Products:

- **Printify Products** are "finished" products in your Printify store—blueprints with your designs applied
- Products created in the Printify dashboard are automatically synced to your backend via webhooks
- Prices can be pushed back from your backend to Printify

### How It Works

1. **Create products in Printify** dashboard (add designs to blueprints)
2. **Sync to backend** via webhook (automatic) or admin API (manual)
3. **Edit prices** in your admin panel
4. **Push prices back** to Printify if desired

### Schema Fields

- `product.printifyProductId` — Printify product.id for bidirectional sync
- `product_variant.printifyVariantId` — Printify variant.id for variant sync
- `product.lastSyncedAt` — When product was last synced

### API Endpoints

```bash
# List local Printify products
GET /api/admin/printify/products

# List available products from Printify API
GET /api/admin/printify/products?source=api

# Import all products from Printify
POST /api/admin/printify/sync
{ "action": "import_all" }

# Import a single product
POST /api/admin/printify/sync
{ "action": "import_single", "printifyProductId": "abc123" }

# Push price changes to Printify
POST /api/admin/printify/sync
{ "action": "export_single", "productId": "abc" }
```

### Webhooks

Product sync events are handled automatically:
- `product:publish:started` — Publish started → we import (product may still show "Publishing" in Printify)
- `product:published` — Publish completed → we import again so data is final
- `product:deleted` — Product deleted in Printify → unpublishes local product

**Register the webhook** in Printify: Settings → Webhooks → Add webhook. URL: `https://your-store.com/api/webhooks/printify` (optionally add `?secret=YOUR_SECRET` and set `PRINTIFY_WEBHOOK_SECRET` in .env).

### Product not showing in store?

1. **"Publishing" status** — Printify can show "Publishing" for a few minutes after you click Publish. The product is synced when the webhook fires (`product:publish:started` or `product:published`). If your webhook isn’t set up or the request failed, the product won’t appear until you sync manually.

2. **Manual sync** — Pull all products from Printify into the store. **Run from the relivator directory** so the script uses the same `.env` and `DATABASE_URL` as the app:
   ```bash
   cd relivator
   bun run printify:sync
   ```
   Or call the admin API: `POST /api/admin/printify/sync` with body `{ "action": "import_all" }`.

   By default only **visible** products are imported. If a product is still "Publishing" (not yet visible in Printify), it will be skipped. Wait until it’s visible, or run the sync script with `visibleOnly: false` (edit `scripts/printify-sync-products.ts` temporarily) to import all.

3. **Verify products are in the database** — If you get 404 when opening a product by slug (e.g. admin edit or storefront), the product may not be in the DB. List products to confirm:
   ```bash
   cd relivator
   bun run db:list-products
   ```
   This shows total count, breakdown by source (printify / printful / manual), and the first 50 products with id, slug, and name. If the list is empty or your product/slug is missing, run `bun run printify:sync` from the same directory.

4. **Publishing settings** — In Printify, ensure "Hide in store" is unchecked and you’ve selected your API store as the sales channel. The note about Etsy/eBay/Amazon applies only to those marketplaces; your custom store is unaffected.

## Product schema alignment

Our product and variant fields align with Printify so we don't need unique table elements. Same schema for all products (manual, Printful, Printify). Examples:

- **Product**: brand, description, title (name), category, SEO (slug, metaDescription), image, price (default/min), weight, source, externalId (Printify: blueprint_id), printifyProductId. **Markets**: we also populate `product_available_country` from the catalog shipping API (see Shipping and shipping countries).
- **Variant** (product_variants table): size, color, quantity/stock, price, SKU, externalId (Printify: variant_id), printifyVariantId, weight, image.

Sync pulls from Printify into this schema. You create the product in Printify, then it syncs to the store.

## Sync flow (products)

- **Printify → backend**: Sync products from your Printify shop → creates **one Product** + **many ProductVariants** in our DB. Includes description, title, tags, variants (size, color, price). Re-sync updates that product and its variants from Printify.
- **Backend → Printify**: Price changes can be pushed back to Printify via the export API. Other edits (description, title) can also be pushed if desired.
- **Visibility**: Only "visible" products are synced by default. Use `visibleOnly: false` to include all products.

## Checkout: email and phone

- **Printify**: Recipient supports `first_name`, `last_name`, `address1`, `city`, `region` (state), `country` (ISO code), `zip`, and optionally `phone`, `email`.
- **Our checkout**: We do **not** need to make email or phone mandatory for customers.

## Order status (customer-facing)

- When we send an order to Printify, we show the customer **pending** or **awaiting shipment**.
- We **do not** pass every Printify status through to the customer. Only expose what's relevant (e.g. **shipped**, **delivered**).

## Shipping and shipping countries

- **Structured shipping countries**: On import and update we call the Printify **catalog** API `GET /v1/catalog/blueprints/{blueprint_id}/print_providers/{print_provider_id}/shipping.json` to get shipping profiles. Each profile has a `countries` array (ISO 2-letter codes or `REST_OF_THE_WORLD`). We map these into our **product_available_country** table so the storefront and checkout know which countries each product can ship to. If any profile lists `REST_OF_THE_WORLD` or the list is empty, we leave the product with no country rows (available everywhere).
- **Description text** (e.g. “This product is shipped only to the United States and Canada”): That text comes from the **product description** in Printify (the product’s `description` field in the API). We import it as-is (HTML). The **structured** list of countries comes from the shipping API above, not from the description.
- For orders that include Printify items, we calculate shipping based on **blueprint + print provider shipping profiles**.
- Printify doesn’t have a direct shipping rate API; rates are derived from catalog shipping info.
- We then apply **our rules** on top: e.g. free shipping over $100, reduced shipping, etc.

## Orders (summary)

- **Our schema**: `ordersTable` has shipping fields, `status`, `printifyOrderId`. Order items have `productId` and optional `productVariantId` (for Printify we use variant's `externalId` = Printify variant_id when sending to Printify).
- **Flow**: After payment, create order in Printify with our order id as `external_id`, recipient from our shipping fields, line items with `product_id` and `variant_id`. Then send to production. Store Printify order id in `printifyOrderId`.
- **Webhooks**: Handle `order:created`, `order:updated`, `order:shipment:created`, etc. Update our DB for internal use.

## Environment

- `PRINTIFY_API_TOKEN` – API token from Printify dashboard (Settings → Connections).
- `PRINTIFY_SHOP_ID` – Your Printify shop ID.
- `PRINTIFY_WEBHOOK_SECRET` – Optional secret to append to webhook URL for verification.

## Files

- **Schema**: `productsTable` (printifyProductId, lastSyncedAt; externalId = blueprint_id), `productVariantsTable` (printifyVariantId, externalId = variant_id), `ordersTable.printifyOrderId`.
- **Lib**: 
  - `src/lib/printify.ts` – API client for catalog, products, orders, and shipping
  - `src/lib/printify-sync.ts` – Bidirectional product synchronization service
  - `src/lib/printify-orders.ts` – Order management (create, cancel, webhooks)
- **API**: 
  - `POST /api/admin/printify/sync` – Product sync actions
  - `GET /api/admin/printify/products` – List Printify products
  - `POST /api/webhooks/printify` – Webhook handler for order and product events

## Implementation order

1. **Products** – Sync products from Printify shop; re-sync updates existing product/variants. Price changes can be pushed back.
2. **Shipping** – Calculate from blueprint/provider shipping profiles, then apply our rules.
3. **Orders** – Send to Printify on payment confirm; webhook handler updates our DB.
