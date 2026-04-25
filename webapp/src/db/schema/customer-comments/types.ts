import type { InferSelectModel } from "drizzle-orm";

import type { customerCommentsTable } from "./tables";

export type CustomerComment = InferSelectModel<typeof customerCommentsTable>;
