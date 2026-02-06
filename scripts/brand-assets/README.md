# Brand logos and assets for production seed

Images in this folder are uploaded to **UploadThing** when you run the brand-asset upload script. They are then linked to seeded brands (logo + optional banner/other assets).

## Folder structure

One folder per brand, named by **brand slug** (lowercase, hyphenated, e.g. `pacsafe`, `earth-runners`):

```
scripts/brand-assets/
├── README.md
├── pacsafe/
│   ├── logo.png      # Main logo → brand.logoUrl + brand_asset type "logo"
│   └── banner.png    # Optional → brand_asset type "banner"
├── cryptomatic/
│   └── logo.png
├── earth-runners/
│   └── logo.webp
└── ...
```

## Naming rules

- **`logo.*`** (e.g. `logo.png`, `logo.webp`) — Used as the brand’s main logo. First one found is set as `brand.logoUrl` and also added as a `brand_asset` with type `logo`.
- **`banner.*`** — Added as `brand_asset` with type `banner`.
- Any other image file (e.g. `hero.png`) — Added as `brand_asset` with type `other`.

Supported extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

## Usage

1. Add image files under `scripts/brand-assets/<brand-slug>/` (create the folder if needed).
2. Ensure `UPLOADTHING_TOKEN` is set in `.env` (same as for the app).
3. Seed brands first, then upload assets:

   ```bash
   bun run db:seed-brands
   bun run db:upload-brand-assets
   ```

   Or for a full production seed including assets:

   ```bash
   bun run db:seed:production
   bun run db:upload-brand-assets
   ```

By default, the script only uploads for brands that **don’t** have a logo yet. Use `--force` to re-upload and update assets for all brands that have a folder here.
