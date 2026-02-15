import { jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Size charts keyed by provider + brand + model.
 * One row per (provider, brand, model); all products with that brand+model share the same chart.
 * Stores both imperial (inches) and metric (cm) when available.
 */
export const sizeChartsTable = pgTable(
  "size_chart",
  {
    /** Blank product brand (e.g. "Bella + Canvas") */
    brand: text("brand").notNull(),
    createdAt: timestamp("created_at").notNull(),
    /** Size guide data in imperial (inches). JSON: { availableSizes, sizeTables: [{ type, unit, description?, imageUrl?, measurements }] } */
    dataImperial: jsonb("data_imperial"),
    /** Size guide data in metric (cm). Same structure as dataImperial. */
    dataMetric: jsonb("data_metric"),
    /** Display label in accordion (e.g. "T-Shirts") */
    displayName: text("display_name").notNull(),
    id: text("id").primaryKey(),
    /** Blank product model (e.g. "3001") */
    model: text("model").notNull(),
    /** printful | printify | manual */
    provider: text("provider").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    unique("size_chart_provider_brand_model_unique").on(
      t.provider,
      t.brand,
      t.model,
    ),
  ],
);
