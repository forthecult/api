import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { userTable } from "../users/tables";

export const blogPostTable = pgTable(
  "blog_post",
  {
    authorDisplayName: text("author_display_name"),
    authorId: text("author_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    coverImageUrl: text("cover_image_url"),
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    metaDescription: text("meta_description"),
    metaTitle: text("meta_title"),
    publishedAt: timestamp("published_at"),
    slug: text("slug").notNull().unique(),
    summary: text("summary"),
    tags: text("tags"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => [
    index("blog_post_slug_idx").on(t.slug),
    index("blog_post_published_at_idx").on(t.publishedAt),
  ],
);
