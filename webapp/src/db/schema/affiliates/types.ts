import type { InferSelectModel } from "drizzle-orm";

import type { affiliateAttributionTable, affiliateTable } from "./tables";

export type Affiliate = InferSelectModel<typeof affiliateTable>;
export type AffiliateAttribution = InferSelectModel<
  typeof affiliateAttributionTable
>;
