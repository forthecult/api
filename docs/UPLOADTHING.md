# UploadThing in this project

**UploadThing** is the app’s **file storage** for images (and optionally video). Files are uploaded to UploadThing’s CDN; the app stores and uses the returned URLs.

---

## What we use it for

| Use | Where | How |
|-----|--------|-----|
| **Product images** | Admin → Products (create/edit) | “Upload” next to primary image or gallery: sends file to UploadThing, then pastes the URL into the form. You can also paste any image URL instead. |
| **Brand logos / assets** | Seeding + Admin → Brands | Script `db:upload-brand-assets` uploads `scripts/brand-assets/<slug>/logo.*` (and optional banner) to UploadThing and sets `brand.logoUrl`. In admin you can also upload or paste URLs. |
| **Logged-in user uploads** | App → Dashboard → Uploads | Users can upload images/videos via the UploadThing React component; files are stored in UploadThing and metadata in `uploads` table. |
| **User avatar** | User profile | Avatar upload uses UploadThing (UTApi) and stores the file URL. |
| **Lookbook** | `/lookbook` page | Optional: run `db:upload-lookbook` to upload `public/lookbook/` to UploadThing; commit `data/lookbook-images.json` so staging/prod serve from UploadThing. |

So in practice:

- **Admin**: Product and brand images can be uploaded via the “Upload” button (which uses UploadThing) or by pasting an image URL.
- **CI / staging seed**: Optional step “Upload brand logos to UploadThing” runs `db:upload-brand-assets`; it only runs if `UPLOADTHING_TOKEN` is set and uses the same token as the app.
- **End users**: Dashboard uploads and avatars go through UploadThing when the app is configured for it.

---

## How to use it

### 1. Get a token

1. Sign up at [uploadthing.com](https://uploadthing.com).
2. Create an app and get your **API token** (Dashboard → your app → API Keys or token).
3. Put it in `.env` **without quotes**:

   ```env
   UPLOADTHING_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   **Important:** Use the raw token. If you use `UPLOADTHING_TOKEN='eyJ...'` (with single or double quotes), some systems treat the quotes as part of the value and UploadThing rejects the request. The app will strip surrounding quotes when it can; for reliability, set the value with no quotes.

### 2. In the admin (products / brands)

- **Upload**: Click “Upload” next to an image field, choose a file. The app sends it to UploadThing via `POST /api/admin/upload` and then fills in the image URL. No extra step for you.
- **Paste URL**: You can leave UploadThing unused and paste any public image URL (e.g. from another CDN or your own host) into the image URL field.

So: **you’re supposed to use UploadThing** when you want the app to host the image (click Upload). **You can skip it** and use “paste a URL” if you already host images elsewhere.

### 3. Brand logos for staging/production

- Put logo (and optional banner) files under `scripts/brand-assets/<brand-slug>/` (e.g. `logo.png`).
- Run:

  ```bash
  bun run db:seed-brands
  bun run db:upload-brand-assets
  ```

  The second command uploads those files to UploadThing and updates brand logo (and asset) URLs. Requires `UPLOADTHING_TOKEN` in `.env`.

- In GitHub Actions, the “Upload brand logos to UploadThing” step is optional: if `UPLOADTHING_TOKEN` is set in repo secrets, it runs the same script after seeding; if not, the step is skipped and brands keep whatever logo URLs they already have (or none).

### 4. Lookbook images (staging / production)

The lookbook page (`/lookbook`) can serve images from UploadThing instead of `public/lookbook/`, so staging and production don’t need those files in the repo.

- **One-time migration:** From the project root, with `UPLOADTHING_TOKEN` in `.env`:

  ```bash
  bun run db:upload-lookbook
  ```

  This uploads every image in `public/lookbook/` to UploadThing and writes **`data/lookbook-images.json`** with the same metadata and the new URLs.

- **Deploy:** Commit **`data/lookbook-images.json`**. On build, the lookbook page will read that file and use the UploadThing URLs. If the file is missing, the page falls back to the static paths under `public/lookbook/`.

- **Note:** The home and about pages still reference a couple of lookbook images by static path (`/lookbook/...`). If you remove `public/lookbook/` from the repo after migrating, update those references to use the URLs from `data/lookbook-images.json` or the same UploadThing URLs.

---

## Summary

- **What for:** Storing images (and optionally video) used by the app: product images, brand logos, user uploads, avatars.
- **How:** Set `UPLOADTHING_TOKEN` in `.env`. In admin, use “Upload” to send files to UploadThing, or paste any image URL. For brand logos in seed, run `bun run db:upload-brand-assets` (and optionally configure the same token in CI).

If you don’t set the token, upload buttons in the app will fail; you can still use “paste a URL” for product and brand images.

---

## Troubleshooting

- **Nothing uploads / “Upload failed”**  
  - Ensure `UPLOADTHING_TOKEN` is set and is the **raw token** (no single or double quotes around it).  
  - In the UploadThing dashboard, confirm the token is for the correct app and not revoked.

- **Seed taking a long time**  
  UploadThing is only used in the optional final step (“Upload brand logos”). The main seed (categories, brands, products, reviews) does not call UploadThing. If seed is slow, the cause is elsewhere (e.g. products/reviews); the pre-extracted `data/reviews-seed.json` keeps review seeding fast.
