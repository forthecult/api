import { relations } from "drizzle-orm";

import { brandAssetTable, brandTable } from "./tables";

export const brandRelations = relations(brandTable, ({ many }) => ({
  assets: many(brandAssetTable),
}));

export const brandAssetRelations = relations(brandAssetTable, ({ one }) => ({
  brand: one(brandTable, {
    fields: [brandAssetTable.brandId],
    references: [brandTable.id],
  }),
}));
