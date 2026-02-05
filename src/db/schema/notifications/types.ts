import type { InferSelectModel } from "drizzle-orm";

import { userNotificationTable } from "./tables";

export type UserNotification = InferSelectModel<typeof userNotificationTable>;
