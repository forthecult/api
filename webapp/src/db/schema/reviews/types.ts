import type { InferSelectModel } from "drizzle-orm";

import type { productReviewsTable } from "./tables";

export type ProductReview = InferSelectModel<typeof productReviewsTable>;
