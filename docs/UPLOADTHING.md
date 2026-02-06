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
- **CI / staging seed**: When `UPLOADTHING_TOKEN` is set as a repo secret (exact name), the workflow runs “Upload brand logos” (`db:upload-brand-assets`) and “Upload lookbook” (`db:upload-lookbook`). If the token is not set, those steps are skipped.
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

- In GitHub Actions, when `UPLOADTHING_TOKEN` is set in **Secrets and variables → Actions** (secret name must be exactly `UPLOADTHING_TOKEN`), the workflow runs brand logo upload and lookbook upload after seeding. If the secret is missing or misnamed, those steps are skipped and nothing is uploaded to UploadThing.

### 4. Lookbook images (staging / production)

The lookbook page (`/lookbook`) can serve images from UploadThing instead of `public/lookbook/`, so staging and production don’t need those files in the repo.

- **One-time migration:** From the project root, with `UPLOADTHING_TOKEN` in `.env`:

  ```bash
  bun run db:upload-lookbook
  ```

  This uploads every image in `public/lookbook/` to UploadThing and writes **`data/lookbook-images.json`** with the same metadata and the new URLs.

- **Deploy:** Commit **`data/lookbook-images.json`**. On build, the lookbook page will read that file and use the UploadThing URLs. If the file is missing, the page falls back to the static paths under `public/lookbook/`. When the seed workflow runs with `UPLOADTHING_TOKEN` set, it uploads lookbook images and produces `data/lookbook-images.json`; the workflow also uploads that file as an artifact **lookbook-images-json** so you can download it and commit it to the repo for deploys.

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

- **Seed staging runs but nothing is uploaded to UploadThing**  
  - Add the repo secret in GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name **exactly** `UPLOADTHING_TOKEN`, value = your UploadThing API token (raw, no quotes). Re-run the “Seed staging” workflow.  
  - In the run log, check the step **“Check UploadThing token”**: it will say either “token is set” (then brand + lookbook upload steps run) or “token not set” (upload steps are skipped). If it says “token not set”, the secret is missing or the name is wrong (e.g. `UPLOADTHING_API_KEY` will not work).  
  - When the token is set, “Upload brand logos” runs from `scripts/brand-assets/<slug>/` for each seeded brand with a matching folder, and “Upload lookbook” runs from `public/lookbook/`. If those steps fail, the job now fails so you can see the error (e.g. invalid token or API error).

- **Seed taking a long time**  
  UploadThing is only used in the optional final step (“Upload brand logos”). The main seed (categories, brands, products, reviews) does not call UploadThing. If seed is slow, the cause is elsewhere (e.g. products/reviews); the pre-extracted `data/reviews-seed.json` keeps review seeding fast.
