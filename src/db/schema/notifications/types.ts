import type { InferSelectModel } from "drizzle-orm";

import type { userNotificationTable } from "./tables";

export type UserNotification = InferSelectModel<typeof userNotificationTable>;
