import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import { blogPostTable } from "./tables";

export const blogPostRelations = relations(blogPostTable, ({ one }) => ({
  author: one(userTable, {
    fields: [blogPostTable.authorId],
    references: [userTable.id],
  }),
}));
