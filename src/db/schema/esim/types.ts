import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import type { esimOrdersTable } from "./tables";

export type EsimOrder = InferSelectModel<typeof esimOrdersTable>;
export type NewEsimOrder = InferInsertModel<typeof esimOrdersTable>;
