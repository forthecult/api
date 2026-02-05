import type { InferSelectModel } from "drizzle-orm";

import type { webhookRegistrationsTable } from "./tables";

export type WebhookRegistration = InferSelectModel<
  typeof webhookRegistrationsTable
>;
