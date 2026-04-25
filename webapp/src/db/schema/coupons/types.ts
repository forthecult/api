import type { InferSelectModel } from "drizzle-orm";

import type {
  couponCategoryTable,
  couponProductTable,
  couponsTable,
} from "./tables";

export type Coupon = InferSelectModel<typeof couponsTable>;
export type CouponCategory = InferSelectModel<typeof couponCategoryTable>;
export type CouponProduct = InferSelectModel<typeof couponProductTable>;
