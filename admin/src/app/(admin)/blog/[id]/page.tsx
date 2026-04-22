"use client";

import { Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getAdminApiBaseUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

interface BlogPost {
  authorDisplayName: null | string;
  authorId: null | string;
  body: string;
  coverImageUrl: null | string;
  createdAt: string;
  id: string;
  metaDescription: null | string;
  metaTitle: null | string;
  publishedAt: null | string;
  slug: string;
  summary: null | string;
  tags: string[];
  title: string;
  updatedAt: string;
}

export default function AdminBlogEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [authorDisplayName, setAuthorDisplayName] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishedAtInput, setPublishedAtInput] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/blog/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Post not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as BlogPost;
      setPost(data);
      setTitle(data.title);
      setSlug(data.slug);
      setSummary(data.summary ?? "");
      setBody(data.body);
      setCoverImageUrl(data.coverImageUrl ?? "");
      setAuthorDisplayName(data.authorDisplayName ?? "");
      setMetaTitle(data.metaTitle ?? "");
      setMetaDescription(data.metaDescription ?? "");
      setTagsInput(tagsToInput(data.tags ?? []));
      setPublishedAtInput(formatDateTimeLocal(data.publishedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchPost();
  }, [fetchPost]);

  const uploadImage = useCallback(async (file: File) => {
    setImageUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        body: form,
        credentials: "include",
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      const data = (await res.json()) as { url: string };
      setCoverImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/blog/${id}`, {
          body: JSON.stringify({
            authorDisplayName: authorDisplayName.trim() || null,
            body: body,
            coverImageUrl: coverImageUrl.trim() || null,
            metaDescription: metaDescription.trim() || null,
            metaTitle: metaTitle.trim() || null,
            publishedAt: publishedAtInput.trim()
              ? new Date(publishedAtInput).toISOString()
              : null,
            slug: slug.trim(),
            summary: summary.trim() || null,
            tags: tagsFromInput(tagsInput),
            title: title.trim(),
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to save");
        }
        const updated = (await res.json()) as BlogPost;
        setPost((prev) => (prev ? { ...prev, ...updated } : updated));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      title,
      slug,
      summary,
      body,
      coverImageUrl,
      authorDisplayName,
      metaTitle,
      metaDescription,
      tagsInput,
      publishedAtInput,
    ],
  );

  const handleDelete = useCallback(async () => {
    if (!id || !post) return;
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/blog/${id}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete");
      }
      router.push("/blog");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [id, post, router]);

  if (loading) {
    return (
      <div
        className={`
        flex min-h-[200px] items-center justify-center text-muted-foreground
      `}
      >
        Loading…
      </div>
    );
  }

  if ((error && !post) || !id) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/blog"
        >
          ← Back to list
        </Link>
        <div
          className={`
            rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
            dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
          `}
        >
          {error ?? "Invalid post"}
        </div>
      </div>
    );
  }

  const viewUrl = post
    ? `${API_BASE.replace(/\/$/, "")}/blog/${post.slug}`
    : "";

  return (
    <div className="space-y-6">
      <div
        className={`
          flex flex-col gap-4
          sm:flex-row sm:items-center sm:justify-between
        `}
      >
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Edit blog post
          </h2>
          <Link
            className={`
              text-sm font-medium text-muted-foreground
              hover:text-foreground
            `}
            href="/blog"
          >
            ← Back to list
          </Link>
          {viewUrl ? (
            <a
              className={`
                text-sm font-medium text-primary
                hover:underline
              `}
              href={viewUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              View post ↗
            </a>
          ) : null}
        </div>
        <Button
          aria-label="Delete post"
          className="gap-2"
          disabled={deleting}
          onClick={handleDelete}
          type="button"
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>

      {error && (
        <div
          className={`
            rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800
            dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
          `}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Post details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`
              grid gap-6
              sm:grid-cols-2
            `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="title">
                  Title
                </label>
                <input
                  className={inputClass}
                  id="title"
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  type="text"
                  value={title}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="slug">
                  Slug (URL)
                </label>
                <input
                  className={inputClass}
                  id="slug"
                  onChange={(e) => setSlug(e.target.value)}
                  type="text"
                  value={slug}
                />
                <p className="text-xs text-muted-foreground">
                  URL: /blog/{slug || post?.slug}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="summary">
                Summary
              </label>
              <textarea
                className={cn(inputClass, "resize-y")}
                id="summary"
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                value={summary}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="body">
                Body
              </label>
              <textarea
                className={cn(inputClass, "min-h-[200px] resize-y")}
                id="body"
                onChange={(e) => setBody(e.target.value)}
                value={body}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Cover image</label>
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadImage(file);
                }}
                ref={imageInputRef}
                type="file"
              />
              <input
                className={inputClass}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                type="url"
                value={coverImageUrl}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  className="gap-1"
                  disabled={imageUploading}
                  onClick={() => imageInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Upload className="size-4" />
                  {imageUploading ? "Uploading…" : "Upload image"}
                </Button>
              </div>
              {coverImageUrl && (
                <div
                  className={`
                  relative mt-2 size-32 overflow-hidden rounded-md border
                  bg-muted
                `}
                >
                  {}
                  <img
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    src={coverImageUrl}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="author">
                Author (display name)
              </label>
              <input
                className={inputClass}
                id="author"
                onChange={(e) => setAuthorDisplayName(e.target.value)}
                type="text"
                value={authorDisplayName}
              />
            </div>

            <hr className="border-border" />

            <div>
              <h3 className="mb-4 text-sm font-semibold">SEO</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="metaTitle">
                    Meta title
                  </label>
                  <input
                    className={inputClass}
                    id="metaTitle"
                    onChange={(e) => setMetaTitle(e.target.value)}
                    type="text"
                    value={metaTitle}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="metaDescription">
                    Meta description
                  </label>
                  <textarea
                    className={cn(inputClass, "resize-y")}
                    id="metaDescription"
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    value={metaDescription}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="tags">
                Tags (comma or newline separated)
              </label>
              <textarea
                className={cn(inputClass, "resize-y")}
                id="tags"
                onChange={(e) => setTagsInput(e.target.value)}
                rows={2}
                value={tagsInput}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="publishedAt">
                Publish at (schedule)
              </label>
              <input
                className={inputClass}
                id="publishedAt"
                onChange={(e) => setPublishedAtInput(e.target.value)}
                type="datetime-local"
                value={publishedAtInput}
              />
              <p className="text-xs text-muted-foreground">
                Empty = draft. Future date = scheduled.
              </p>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Link
                className={cn(
                  `
                    inline-flex items-center justify-center rounded-md border
                    border-input bg-background px-4 py-2 text-sm font-medium
                    transition-colors
                    hover:bg-muted hover:text-muted-foreground
                  `,
                )}
                href="/blog"
              >
                Cancel
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function formatDateTimeLocal(s: null | string): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tagsFromInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagsToInput(tags: string[]): string {
  return Array.isArray(tags) ? tags.join(", ") : "";
}
