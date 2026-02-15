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
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Short description of what the brand offers. */
    description: text("description"),
    featured: boolean("featured").notNull().default(false),
    id: text("id").primaryKey(),
    /** Main logo URL (single image). */
    logoUrl: text("logo_url"),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    /** Brand website URL. */
    websiteUrl: text("website_url"),
  },
  // L13: Removed redundant brand_slug_idx — slug column already has a unique constraint which creates an implicit unique index
  () => [],
);

export const brandAssetTable = pgTable(
  "brand_asset",
  {
    brandId: text("brand_id")
      .notNull()
      .references(() => brandTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    id: text("id").primaryKey(),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Type of asset for display/filtering: logo | banner | other */
    type: text("type").notNull().default("other"),
    /** URL of the asset (e.g. from UploadThing or external). */
    url: text("url").notNull(),
  },
  (t) => [index("brand_asset_brand_id_idx").on(t.brandId)],
);
