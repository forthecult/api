import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { userNotificationTable } from "./tables";

export const userNotificationRelations = relations(
  userNotificationTable,
  ({ one }) => ({
    user: one(userTable),
  }),
);
