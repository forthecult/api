import { and, desc, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "~/db";
import { blogPostTable } from "~/db/schema";

const now = () => new Date();

function parseTags(value: null | string | undefined): string[] {
  if (value == null || value === "") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? (parsed as string[]).filter((t) => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

/** Published = publishedAt is set and <= now. Returns posts with tags parsed. */
export async function getPublishedBlogPosts(limit = 50) {
  const publishedCondition = and(
    isNotNull(blogPostTable.publishedAt),
    lte(blogPostTable.publishedAt, now()),
  );
  const rows = await db.query.blogPostTable.findMany({
    columns: {
      authorDisplayName: true,
      coverImageUrl: true,
      id: true,
      metaDescription: true,
      metaTitle: true,
      publishedAt: true,
      slug: true,
      summary: true,
      tags: true,
      title: true,
    },
    limit,
    orderBy: [desc(blogPostTable.publishedAt)],
    where: publishedCondition,
  });
  return rows.map((r) => ({ ...r, tags: parseTags(r.tags) }));
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const publishedCondition = and(
    eq(blogPostTable.slug, slug),
    isNotNull(blogPostTable.publishedAt),
    lte(blogPostTable.publishedAt, now()),
  );
  const [row] = await db
    .select()
    .from(blogPostTable)
    .where(publishedCondition)
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    tags: parseTags(row.tags),
  };
}

export async function getAllPublishedSlugs(): Promise<string[]> {
  const publishedCondition = and(
    isNotNull(blogPostTable.publishedAt),
    lte(blogPostTable.publishedAt, now()),
  );
  const rows = await db
    .select({ slug: blogPostTable.slug })
    .from(blogPostTable)
    .where(publishedCondition);
  return rows.map((r) => r.slug).filter(Boolean);
}
