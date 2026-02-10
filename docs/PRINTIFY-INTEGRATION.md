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

# Clear stuck "Publishing" (re-call publish so Printify marks as Published)
POST /api/admin/printify/sync
{ "action": "confirm_publish" }
# Or one product: { "action": "confirm_publish", "printifyProductId": "abc123" } or { "productId": "our-id" }

# Push price changes to Printify
POST /api/admin/printify/sync
{ "action": "export_single", "productId": "abc" }
```

### Webhooks

Product sync events are handled automatically:
- `product:publish:started` — Publish started → we **return 200 immediately** so Printify marks the product as "Published", then we import in the background
- `product:published` — Publish completed → same: 200 first, import in background
- `product:deleted` — Product deleted in Printify → 200 first, unpublish local product in background

We return HTTP 200 right away for product events so Printify can clear the "Publishing" status. While a product is in "Publishing", Printify's API returns **400 code 8252 "Product is disabled for editing"** for any update (including our export-after-save); we treat that as expected and log at info level. If we waited for the full import before responding, Printify could timeout and leave products stuck in "Publishing".

**Important: the only way to register or update Printify webhooks is via our app’s API.** Printify has no webhook UI in their front-end for API stores—do not try to configure webhooks in the Printify dashboard.

- **Register webhooks:** `POST /api/admin/printify/webhooks` with `{ "action": "register_all" }`. This **replaces all** existing webhooks for the shop (deletes then re-registers) so only our URL receives events—avoiding stuck "Publishing" when old or staging URLs were still registered and returned non-2xx.
- **Check status:** `GET /api/admin/printify/webhooks` (or `GET /api/admin/printify/sync` for `webhooks` in the response).
- The app may auto-register the required product webhooks when you run **import_all**, **import_single**, or **confirm_publish** from `POST /api/admin/printify/sync` (if `NEXT_PUBLIC_APP_URL` is a public URL Printify can reach). If auto-registration fails (e.g. staging URL not yet reachable), register explicitly via `POST /api/admin/printify/webhooks` with `{ "action": "register_all" }`.
- Webhook URL is built from `NEXT_PUBLIC_APP_URL` (and `PRINTIFY_WEBHOOK_SECRET` if set). Ensure `NEXT_PUBLIC_APP_URL` is your **public** store URL (not localhost) so Printify's servers can reach it. `GET /api/webhooks/printify` always returns 200 so Printify's URL validation (error 9004) succeeds during registration.

**Production vs staging:** Printify has one store per shop; the webhook URL you register is where **all** events for that shop are sent. To have products land in **production**: (1) Remove staging webhooks: from **production** admin, use **"Delete all webhooks"** on the product page (Markets section), or `POST /api/admin/printify/webhooks` with `{ "action": "delete_all" }`. That clears every webhook for the shop (including staging URLs). (2) Then **"Register webhooks"** from production (or `{ "action": "register_all" }`) so only the production URL is registered. To remove only webhooks that point to staging (e.g. URL contains "staging"), use `{ "action": "delete_where_url_contains", "urlContains": "staging" }`.

### Product not showing in store?

1. **"Publishing" status** — Printify can show "Publishing" for a few minutes after you click Publish. The product is synced when the webhook fires (`product:publish:started` or `product:published`). If your webhook isn’t set up or the request failed, the product won’t appear until you sync manually.

2. **Clear stuck "Publishing"** — Sync and Confirm publish often **do not** change status for products already stuck in Publishing (Printify may not re-send the webhook when we call the publish API again). **Reliable fix:** (1) Register webhooks via our API (`POST /api/admin/printify/webhooks` with `{ "action": "register_all" }` or use the "Register webhooks" button on the product edit page). (2) Delete the product in Printify (e.g. "Delete from Printify" on the product page, or by Printify product ID). (3) Re-create or re-publish the product in Printify; the webhook will fire, we return 200, and status becomes Published. You can then re-import the product if needed. Ensure [webhooks are registered](#webhooks) first (only way—no Printify front-end for this).

3. **Manual import** — Pull all products from Printify into the store. **Run from the relivator directory** so the script uses the same `.env` and `DATABASE_URL` as the app:
   ```bash
   cd relivator
   bun run printify:sync
   ```
   Or call the admin API: `POST /api/admin/printify/sync` with body `{ "action": "import_all" }`.

   By default only **visible** products are imported. If a product is still "Publishing" (not yet visible in Printify), it will be skipped. Wait until it’s visible, or run the sync script with `visibleOnly: false` (edit `scripts/printify-sync-products.ts` temporarily) to import all.

4. **Verify products are in the database** — If you get 404 when opening a product by slug (e.g. admin edit or storefront), the product may not be in the DB. List products to confirm:
   ```bash
   cd relivator
   bun run db:list-products
   ```
   This shows total count, breakdown by source (printify / printful / manual), and the first 50 products with id, slug, and name. If the list is empty or your product/slug is missing, run `bun run printify:sync` from the same directory.

5. **Publishing settings** — In Printify, ensure "Hide in store" is unchecked and you’ve selected your API store as the sales channel. The note about Etsy/eBay/Amazon applies only to those marketplaces; your custom store is unaffected.

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
