import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { getPublishedBlogPosts } from "~/lib/blog";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/blog`,
  },
  description:
    "News, culture, and updates from the team. Read the latest from the store.",
  openGraph: {
    description:
      "News, culture, and updates from the team. Read the latest from the store.",
    title: `Blog | ${SEO_CONFIG.name}`,
    type: "website",
  },
  title: `Blog | ${SEO_CONFIG.name}`,
};

export const revalidate = 60;

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts(30);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-12 border-b border-border pb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Blog
        </h1>
        <p className="mt-2 text-muted-foreground">
          News, culture, and updates from the team.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">No posts yet. Check back soon.</p>
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
                href={`/blog/${post.slug}`}
              >
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {post.coverImageUrl ? (
                    <Image
                      alt=""
                      className="object-cover transition-transform group-hover:scale-105"
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      src={post.coverImageUrl}
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-foreground group-hover:underline">
                    {post.title}
                  </h2>
                  {post.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.summary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {post.publishedAt && (
                      <time
                        dateTime={
                          new Date(post.publishedAt).toISOString()
                        }
                      >
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </time>
                    )}
                    {post.authorDisplayName ? (
                      <span>· {post.authorDisplayName}</span>
                    ) : null}
                    {Array.isArray(post.tags) && post.tags.length > 0 ? (
                      <span>· {post.tags.slice(0, 3).join(", ")}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
