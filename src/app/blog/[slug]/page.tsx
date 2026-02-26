import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { getPublishedBlogPostBySlug } from "~/lib/blog";

const siteUrl = getPublicSiteUrl();

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) {
    return { title: `Post not found | ${SEO_CONFIG.name}` };
  }
  const title = post.metaTitle ?? post.title;
  const description =
    post.metaDescription ?? post.summary ?? undefined;
  const image = post.coverImageUrl ?? undefined;
  return {
    alternates: {
      canonical: `${siteUrl}/blog/${post.slug}`,
    },
    description: description ?? undefined,
    robots: { follow: true, index: true },
    openGraph: {
      description: description ?? undefined,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
      title: `${title} | ${SEO_CONFIG.name}`,
      type: "article",
    },
    title: `${title} | ${SEO_CONFIG.name}`,
    twitter: {
      card: image ? "summary_large_image" : "summary",
      description: description ?? undefined,
      images: image ? [image] : undefined,
      title: `${title} | ${SEO_CONFIG.name}`,
    },
  };
}

export const revalidate = 60;

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <Link
        className="mb-8 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
        href="/blog"
      >
        ← Blog
      </Link>

      {post.coverImageUrl ? (
        <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            src={post.coverImageUrl}
          />
        </div>
      ) : null}

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {post.publishedAt && (
            <time
              dateTime={new Date(post.publishedAt).toISOString()}
            >
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                dateStyle: "long",
              })}
            </time>
          )}
          {post.authorDisplayName ? (
            <span>{post.authorDisplayName}</span>
          ) : null}
          {Array.isArray(post.tags) && post.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </header>

      <div className="max-w-none whitespace-pre-wrap text-foreground">
        {post.body}
      </div>
    </article>
  );
}
