import { relations } from "drizzle-orm";

import { userNotificationTable } from "./tables";
import { userTable } from "../users/tables";

export const userNotificationRelations = relations(
  userNotificationTable,
  ({ one }) => ({
    user: one(userTable),
  }),
);
