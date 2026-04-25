import type { InferSelectModel } from "drizzle-orm";

import type { memberTierDiscountTable } from "./tables";

export type MemberTierDiscount = InferSelectModel<
  typeof memberTierDiscountTable
>;
