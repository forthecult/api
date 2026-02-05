import type { InferSelectModel } from "drizzle-orm";

import type { userWalletsTable } from "./tables";

export type UserWallet = InferSelectModel<typeof userWalletsTable>;
