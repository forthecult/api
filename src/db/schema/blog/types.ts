import type { blogPostTable } from "./tables";

export type BlogPost = typeof blogPostTable.$inferSelect;
export type NewBlogPost = typeof blogPostTable.$inferInsert;
