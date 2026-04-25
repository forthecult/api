import type { InferSelectModel } from "drizzle-orm";

import type {
  customPrintsTable,
  orderItemsTable,
  ordersTable,
  productsTable,
  productVariantsTable,
} from "./tables";

export type CustomPrint = InferSelectModel<typeof customPrintsTable>;
export type Order = InferSelectModel<typeof ordersTable>;
export type OrderItem = InferSelectModel<typeof orderItemsTable>;
export type Product = InferSelectModel<typeof productsTable>;
export type ProductVariant = InferSelectModel<typeof productVariantsTable>;
