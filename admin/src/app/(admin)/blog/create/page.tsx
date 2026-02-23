"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

function tagsFromInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminBlogCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
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
      if (!title.trim()) {
        setError("Title is required.");
        return;
      }
      const slugVal = slug.trim() || title.trim().toLowerCase().replace(/\s+/g, "-");
      if (!slugVal) {
        setError("Slug is required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/blog`, {
          body: JSON.stringify({
            authorDisplayName: authorDisplayName.trim() || null,
            body: body.trim() || "",
            coverImageUrl: coverImageUrl.trim() || null,
            metaDescription: metaDescription.trim() || null,
            metaTitle: metaTitle.trim() || null,
            publishedAt: publishedAtInput.trim()
              ? new Date(publishedAtInput).toISOString()
              : null,
            slug: slugVal,
            summary: summary.trim() || null,
            tags: tagsFromInput(tagsInput),
            title: title.trim(),
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to create post");
        }
        router.push("/blog");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create post",
        );
      } finally {
        setSaving(false);
      }
    },
    [
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
      router,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          New blog post
        </h2>
        <Link
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
          href="/blog"
        >
          ← Back to list
        </Link>
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
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass} htmlFor="title">
                  Title
                </label>
                <input
                  className={inputClass}
                  id="title"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
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
                  placeholder="e.g. my-first-post (defaults from title)"
                  type="text"
                  value={slug}
                />
                <p className="text-xs text-muted-foreground">
                  URL will be /blog/[slug]
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
                placeholder="Short excerpt for listings"
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
                placeholder="Post content (markdown or HTML)"
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
                placeholder="https://… or upload below"
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
                <div className="relative mt-2 size-32 overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                placeholder="e.g. Jane Doe"
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
                    placeholder="Defaults to post title if empty"
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
                    placeholder="Short summary for search results"
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
                placeholder="fashion, news, culture"
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
                min={formatDateTimeLocal(new Date())}
                onChange={(e) => setPublishedAtInput(e.target.value)}
                type="datetime-local"
                value={publishedAtInput}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for draft. Set a future date/time to schedule
                release.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button disabled={saving} type="submit">
                {saving ? "Creating…" : "Create post"}
              </Button>
              <Link
                className={cn(
                  `
                    inline-flex items-center justify-center rounded-md border
                    border-input bg-background px-4 py-2 text-sm font-medium
                    transition-colors hover:bg-muted hover:text-muted-foreground
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
