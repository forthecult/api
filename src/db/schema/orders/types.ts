import type { InferSelectModel } from "drizzle-orm";

import type {
  customPrintsTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
} from "./tables";

export type Product = InferSelectModel<typeof productsTable>;
export type ProductVariant = InferSelectModel<typeof productVariantsTable>;
export type Order = InferSelectModel<typeof ordersTable>;
export type OrderItem = InferSelectModel<typeof orderItemsTable>;
export type CustomPrint = InferSelectModel<typeof customPrintsTable>;
