"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import type { TokenGateRow } from "~/ui/token-gates-list";
import { TokenGatesList } from "~/ui/token-gates-list";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type CategoryOption = { id: string; name: string };

export default function AdminCategoriesCreatePage() {
  const router = useRouter();
  const [parentOptions, setParentOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [description, setDescription] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [level, setLevel] = useState(1);
  const [featured, setFeatured] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tokenGated, setTokenGated] = useState(false);
  const [tokenGates, setTokenGates] = useState<TokenGateRow[]>([]);

  const fetchParentOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories?limit=200`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { items: CategoryOption[] };
      setParentOptions(json.items ?? []);
    } catch {
      // non-blocking
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchParentOptions();
  }, [fetchParentOptions]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim() || null,
            title: title.trim() || null,
            metaDescription: metaDescription.trim() || null,
            description: description.trim() || null,
            seoOptimized,
            imageUrl: imageUrl.trim() || null,
            level,
            featured,
            visible,
            parentId: parentId || null,
            tokenGated,
            tokenGates,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to create category");
        }
        router.push("/categories");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create category",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      slug,
      title,
      metaDescription,
      description,
      seoOptimized,
      imageUrl,
      level,
      featured,
      visible,
      parentId,
      tokenGated,
      tokenGates,
      router,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Create Category
        </h2>
        <Link
          href="/categories"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to list
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Category details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="parent" className={labelClass}>
                  Parent category
                </label>
                <select
                  id="parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className={inputClass}
                  disabled={loading}
                >
                  <option value="">None</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="imageUrl" className={labelClass}>
                Image URL
              </label>
              <input
                id="imageUrl"
                type="url"
                placeholder="https://…"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className={inputClass}
              />
              {imageUrl && (
                <div className="relative mt-2 size-20 overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <TokenGatesList
              gates={tokenGates}
              onChange={setTokenGates}
              tokenGated={tokenGated}
              onTokenGatedChange={setTokenGated}
              title="Category token gates"
              description="Require user to hold ≥ quantity of ANY of these tokens to access this category."
              inputClass={inputClass}
              labelClass={labelClass}
            />

            <hr className="border-border" />

            <div>
              <h3 className="mb-4 text-sm font-semibold">SEO</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Title, meta description, description, and slug are used for
                search engines and category pages. Slug is used in the URL (e.g.
                /products/mens-fashion).
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className={labelClass}>
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    placeholder="SEO / page title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in &lt;title&gt; and og:title. Defaults to category
                    name if empty.
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="slug" className={labelClass}>
                    Slug
                  </label>
                  <input
                    id="slug"
                    type="text"
                    placeholder="e.g. mens-fashion"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-friendly identifier. Auto-generated from name if empty.
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="metaDescription" className={labelClass}>
                    Meta Description
                  </label>
                  <textarea
                    id="metaDescription"
                    placeholder="Short summary for search results (e.g. 150–160 chars)"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    className={cn(inputClass, "resize-y")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in search snippets. Keep it concise.
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="description" className={labelClass}>
                    Description
                  </label>
                  <textarea
                    id="description"
                    placeholder="Longer content for the category page"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className={cn(inputClass, "resize-y")}
                  />
                </div>
                <label className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={seoOptimized}
                    onChange={(e) => setSeoOptimized(e.target.checked)}
                    className="size-4 rounded border-input"
                  />
                  <span className="text-sm">Optimized</span>
                </label>
                <p className="text-xs text-muted-foreground">
                  Category has been optimized for SEO / content / copy.
                </p>
              </div>
            </div>

            <hr className="border-border" />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  id="visible"
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring"
                />
                <label htmlFor="visible" className="text-sm font-medium">
                  Visible in store
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="featured"
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-ring"
                />
                <label htmlFor="featured" className="text-sm font-medium">
                  Featured Category
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Category"}
              </Button>
              <Link
                href="/categories"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground"
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
