"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { TokenGateRow } from "~/ui/token-gates-list";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { TokenGatesList } from "~/ui/token-gates-list";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

interface CategoryOption {
  id: string;
  name: string;
}

export default function AdminCategoriesCreatePage() {
  const router = useRouter();
  const [parentOptions, setParentOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [description, setDescription] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [level, _setLevel] = useState(1);
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
          body: JSON.stringify({
            description: description.trim() || null,
            featured,
            imageUrl: imageUrl.trim() || null,
            level,
            metaDescription: metaDescription.trim() || null,
            name: name.trim(),
            parentId: parentId || null,
            seoOptimized,
            slug: slug.trim() || null,
            title: title.trim() || null,
            tokenGated,
            tokenGates,
            visible,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
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
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/categories"
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
            <CardTitle>Category details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className={`
                grid gap-6
                sm:grid-cols-2
              `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="name">
                  Name
                </label>
                <input
                  className={inputClass}
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  required
                  type="text"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="parent">
                  Parent category
                </label>
                <select
                  className={inputClass}
                  disabled={loading}
                  id="parent"
                  onChange={(e) => setParentId(e.target.value)}
                  value={parentId}
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
              <label className={labelClass} htmlFor="imageUrl">
                Image URL
              </label>
              <input
                className={inputClass}
                id="imageUrl"
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                value={imageUrl}
              />
              {imageUrl && (
                <div
                  className={`
                    relative mt-2 size-20 overflow-hidden rounded-md border
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
                    src={imageUrl}
                  />
                </div>
              )}
            </div>

            <TokenGatesList
              description="Require user to hold ≥ quantity of ANY of these tokens to access this category."
              gates={tokenGates}
              inputClass={inputClass}
              labelClass={labelClass}
              onChange={setTokenGates}
              onTokenGatedChange={setTokenGated}
              title="Category token gates"
              tokenGated={tokenGated}
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
                  <label className={labelClass} htmlFor="title">
                    Title
                  </label>
                  <input
                    className={inputClass}
                    id="title"
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="SEO / page title"
                    type="text"
                    value={title}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used in &lt;title&gt; and og:title. Defaults to category
                    name if empty.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="slug">
                    Slug
                  </label>
                  <input
                    className={inputClass}
                    id="slug"
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. mens-fashion"
                    type="text"
                    value={slug}
                  />
                  <p className="text-xs text-muted-foreground">
                    URL-friendly identifier. Auto-generated from name if empty.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="metaDescription">
                    Meta Description
                  </label>
                  <textarea
                    className={cn(inputClass, "resize-y")}
                    id="metaDescription"
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Short summary for search results (e.g. 150–160 chars)"
                    rows={2}
                    value={metaDescription}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown in search snippets. Keep it concise.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="description">
                    Description
                  </label>
                  <textarea
                    className={cn(inputClass, "resize-y")}
                    id="description"
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Longer content for the category page"
                    rows={4}
                    value={description}
                  />
                </div>
                <label className="flex items-center gap-2 pt-2">
                  <input
                    checked={seoOptimized}
                    className="size-4 rounded border-input"
                    onChange={(e) => setSeoOptimized(e.target.checked)}
                    type="checkbox"
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
                  checked={visible}
                  className={`
                    size-4 rounded border-input text-primary
                    focus:ring-ring
                  `}
                  id="visible"
                  onChange={(e) => setVisible(e.target.checked)}
                  type="checkbox"
                />
                <label className="text-sm font-medium" htmlFor="visible">
                  Visible in store
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  checked={featured}
                  className={`
                    size-4 rounded border-input text-primary
                    focus:ring-ring
                  `}
                  id="featured"
                  onChange={(e) => setFeatured(e.target.checked)}
                  type="checkbox"
                />
                <label className="text-sm font-medium" htmlFor="featured">
                  Featured Category
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : "Save Category"}
              </Button>
              <Link
                className={`
                  inline-flex items-center justify-center rounded-md border
                  border-input bg-background px-4 py-2 text-sm font-medium
                  transition-colors
                  hover:bg-muted hover:text-muted-foreground
                `}
                href="/categories"
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
