import type { InferSelectModel } from "drizzle-orm";

import type { supportTicketTable } from "./tables";

export type SupportTicket = InferSelectModel<typeof supportTicketTable>;
