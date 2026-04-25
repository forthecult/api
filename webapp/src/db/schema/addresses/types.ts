import type { InferSelectModel } from "drizzle-orm";

import type { addressesTable } from "./tables";

export type Address = InferSelectModel<typeof addressesTable>;
