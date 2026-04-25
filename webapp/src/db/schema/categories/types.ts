import type { InferSelectModel } from "drizzle-orm";

import type { categoriesTable, productCategoriesTable } from "./tables";

export type Category = InferSelectModel<typeof categoriesTable>;
export type ProductCategory = InferSelectModel<typeof productCategoriesTable>;
