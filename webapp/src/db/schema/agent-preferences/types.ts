import type { InferSelectModel } from "drizzle-orm";

import type { agentPreferencesTable } from "./tables";

export type AgentPreference = InferSelectModel<typeof agentPreferencesTable>;
