import type { InferSelectModel } from "drizzle-orm";

import { agentPreferencesTable } from "./tables";

export type AgentPreference = InferSelectModel<typeof agentPreferencesTable>;
