import type { InferSelectModel } from "drizzle-orm";

import type { wishlistTable } from "./tables";

export type WishlistItem = InferSelectModel<typeof wishlistTable>;
