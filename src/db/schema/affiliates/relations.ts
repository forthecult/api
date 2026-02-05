import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";

import { affiliateAttributionTable, affiliateTable } from "./tables";

export const affiliateRelations = relations(affiliateTable, ({ one, many }) => ({
  user: one(userTable, {
    fields: [affiliateTable.userId],
    references: [userTable.id],
  }),
  attributions: many(affiliateAttributionTable),
}));

export const affiliateAttributionRelations = relations(
  affiliateAttributionTable,
  ({ one }) => ({
    affiliate: one(affiliateTable, {
      fields: [affiliateAttributionTable.affiliateId],
      references: [affiliateTable.id],
    }),
  }),
);
