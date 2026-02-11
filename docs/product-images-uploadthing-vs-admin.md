<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Product images: UploadThing vs admin (backend)

Images can exist in two places:

1. **UploadThing** – files stored on the CDN (utfs.io / ufs.sh).
2. **Admin (backend)** – product records: `product.imageUrl`, `product_images`, `product_variant.imageUrl`.

They are only linked when something **writes those URLs into the database**. If images were "added multiple times to UploadThing but never admin", it means files are on the CDN but product records still point at old URLs (e.g. minirigs.co.uk, itead).

## How the backend gets updated

- **Admin UI:** Upload returns a URL and updates the form; you must click **Save** to persist. If you don’t save, the product still has the old URLs.
- **Scripts:** `sonoff-images-to-cdn.ts` and `minirig-images-to-cdn.ts` fetch images, upload to UploadThing, then **PATCH** the product. If the upload step returns 500, the PATCH never runs, so the backend is never updated.

## Fix: update admin so it uses your CDN URLs

**Option A – Run the CDN scripts (after upload works)**

1. Deploy the latest relivator app (upload route that correctly reads UploadThing’s response and returns the URL).
2. Ensure `UPLOADTHING_TOKEN` is set in production.
3. Run:
   - `MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/sonoff-images-to-cdn.ts`
   - `MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/minirig-images-to-cdn.ts`
4. Scripts will upload (may create more files on UploadThing) and PATCH products so the admin uses the new CDN URLs.

**Option B – Use existing UploadThing URLs (no new uploads)**

If you already have the UploadThing URLs (e.g. from the UploadThing dashboard or from when you uploaded):

1. Create a JSON file with product slug → `imageUrl`, `images[]`, optional `variantImageUrls`. See `scripts/product-images-example.json`.
2. Run:
   - `PRODUCT_IMAGES_JSON=./your-urls.json MAIN_APP_URL=... ADMIN_AI_API_KEY=... bun run scripts/patch-product-images-from-json.ts`
3. That PATCHes the products so the admin points at those existing CDN URLs.

After either option, the Media section in the admin and the storefront will show images from your CDN.
