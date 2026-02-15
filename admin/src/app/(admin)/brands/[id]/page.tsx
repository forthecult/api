"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

interface AssetRow {
  id?: string;
  sortOrder?: number;
  type: string;
  url: string;
}

interface Brand {
  assets: { id: string; sortOrder: number; type: string; url: string }[];
  createdAt: string;
  description: null | string;
  featured: boolean;
  id: string;
  logoUrl: null | string;
  name: string;
  slug: string;
  updatedAt: string;
  websiteUrl: null | string;
}

export default function AdminBrandEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const fetchBrand = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Brand not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Brand;
      setBrand(data);
      setName(data.name);
      setSlug(data.slug ?? "");
      setWebsiteUrl(data.websiteUrl ?? "");
      setDescription(data.description ?? "");
      setFeatured(data.featured);
      setLogoUrl(data.logoUrl ?? "");
      setAssets(
        (data.assets ?? []).map((a) => ({
          id: a.id,
          sortOrder: a.sortOrder,
          type: a.type || "other",
          url: a.url,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brand");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchBrand();
  }, [fetchBrand]);

  const addAsset = useCallback(() => {
    setAssets((prev) => [...prev, { type: "other", url: "" }]);
  }, []);

  const removeAsset = useCallback((index: number) => {
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAsset = useCallback(
    (index: number, field: "type" | "url", value: string) => {
      setAssets((prev) =>
        prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
      );
    },
    [],
  );

  const uploadAssetInputRef = useRef<HTMLInputElement>(null);
  const uploadAssetTargetRef = useRef<null | number>(null);
  const [uploadAssetLoading, setUploadAssetLoading] = useState(false);
  const handleUploadAsset = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const target = uploadAssetTargetRef.current;
      uploadAssetTargetRef.current = null;
      if (!file || target === null) return;
      setUploadAssetLoading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${API_BASE}/api/admin/upload`, {
          body: form,
          credentials: "include",
          method: "POST",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Upload failed");
        }
        const data = (await res.json()) as { url: string };
        updateAsset(target, "url", data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadAssetLoading(false);
      }
    },
    [updateAsset],
  );
  const triggerUploadAsset = useCallback((index: number) => {
    uploadAssetTargetRef.current = index;
    uploadAssetInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
          body: JSON.stringify({
            assets: assets
              .filter((a) => a.url.trim())
              .map((a, i) => ({
                id: a.id,
                sortOrder: i,
                type: a.type || "other",
                url: a.url.trim(),
              })),
            description: description.trim() || undefined,
            featured,
            logoUrl: logoUrl.trim() || undefined,
            name: name.trim(),
            slug: slug.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to save brand");
        }
        void fetchBrand();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save brand");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      name,
      slug,
      websiteUrl,
      description,
      featured,
      logoUrl,
      assets,
      fetchBrand,
    ],
  );

  const handleDelete = useCallback(async () => {
    if (!id || !brand) return;
    if (!window.confirm(`Delete brand "${brand.name}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete");
      }
      router.push("/brands");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [id, brand, router]);

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

  if (error && !brand) {
    return (
      <div className="space-y-4">
        <div
          className={`
          rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
          dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
        `}
        >
          {error}
        </div>
        <Link href="/brands">
          <Button type="button" variant="outline">
            ← Back to brands
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Edit Brand</h2>
          <Link
            className={`
              text-sm font-medium text-muted-foreground
              hover:text-foreground
            `}
            href="/brands"
          >
            ← Back to list
          </Link>
        </div>
        <Button
          disabled={deleting}
          onClick={handleDelete}
          type="button"
          variant="destructive"
        >
          {deleting ? "Deleting…" : "Delete brand"}
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
            <CardTitle>Brand details</CardTitle>
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
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputClass}
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PacSafe"
                  required
                  type="text"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="slug">
                  Slug
                </label>
                <input
                  className={inputClass}
                  id="slug"
                  onChange={(e) => setSlug(e.target.value)}
                  type="text"
                  value={slug}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="websiteUrl">
                Website URL
              </label>
              <input
                className={inputClass}
                id="websiteUrl"
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
                value={websiteUrl}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="description">
                Description
              </label>
              <textarea
                className={cn(inputClass, "resize-y")}
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what the brand offers"
                rows={3}
                value={description}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass} htmlFor="logoUrl">
                Logo URL
              </label>
              <input
                className={inputClass}
                id="logoUrl"
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                value={logoUrl}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                checked={featured}
                className="size-4 rounded border-input"
                id="featured"
                onChange={(e) => setFeatured(e.target.checked)}
                type="checkbox"
              />
              <label className="text-sm font-medium" htmlFor="featured">
                Featured Brand
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  Brand assets (logos, banners)
                </label>
                <Button
                  onClick={addAsset}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  + Add asset
                </Button>
              </div>
              <input
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-hidden
                className="hidden"
                onChange={handleUploadAsset}
                ref={uploadAssetInputRef}
                type="file"
              />
              {assets.length > 0 && (
                <ul className="space-y-2">
                  {assets.map((a, i) => (
                    <li
                      className={`
                        flex flex-wrap items-center gap-2 rounded border p-2
                      `}
                      key={a.id ?? i}
                    >
                      <input
                        className={cn(inputClass, "min-w-[200px] flex-1")}
                        onChange={(e) => updateAsset(i, "url", e.target.value)}
                        placeholder="Image URL"
                        type="url"
                        value={a.url}
                      />
                      <Button
                        className="shrink-0 gap-1"
                        disabled={uploadAssetLoading}
                        onClick={() => triggerUploadAsset(i)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                      <select
                        className={cn(inputClass, "w-28")}
                        onChange={(e) => updateAsset(i, "type", e.target.value)}
                        value={a.type}
                      >
                        <option value="logo">Logo</option>
                        <option value="banner">Banner</option>
                        <option value="other">Other</option>
                      </select>
                      <Button
                        className={`
                          text-destructive
                          hover:text-destructive
                        `}
                        onClick={() => removeAsset(i)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2">
              <Button disabled={saving} type="submit">
                {saving ? "Saving…" : "Save Brand"}
              </Button>
              <Link href="/brands">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
