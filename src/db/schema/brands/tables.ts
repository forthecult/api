import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const brandTable = pgTable(
  "brand",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** Main logo URL (single image). */
    logoUrl: text("logo_url"),
    /** Brand website URL. */
    websiteUrl: text("website_url"),
    /** Short description of what the brand offers. */
    description: text("description"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // L13: Removed redundant brand_slug_idx — slug column already has a unique constraint which creates an implicit unique index
  () => [],
);

export const brandAssetTable = pgTable(
  "brand_asset",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brandTable.id, { onDelete: "cascade" }),
    /** URL of the asset (e.g. from UploadThing or external). */
    url: text("url").notNull(),
    /** Type of asset for display/filtering: logo | banner | other */
    type: text("type").notNull().default("other"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("brand_asset_brand_id_idx").on(t.brandId)],
);
