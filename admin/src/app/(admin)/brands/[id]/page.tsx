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

type AssetRow = { id?: string; url: string; type: string; sortOrder?: number };

type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  description: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  assets: Array< { id: string; url: string; type: string; sortOrder: number }>;
};

export default function AdminBrandEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          url: a.url,
          type: a.type || "other",
          sortOrder: a.sortOrder,
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
    setAssets((prev) => [...prev, { url: "", type: "other" }]);
  }, []);

  const removeAsset = useCallback((index: number) => {
    setAssets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateAsset = useCallback((index: number, field: "url" | "type", value: string) => {
    setAssets((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    );
  }, []);

  const uploadAssetInputRef = useRef<HTMLInputElement>(null);
  const uploadAssetTargetRef = useRef<number | null>(null);
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
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
            description: description.trim() || undefined,
            featured,
            logoUrl: logoUrl.trim() || undefined,
            assets: assets
              .filter((a) => a.url.trim())
              .map((a, i) => ({
                id: a.id,
                url: a.url.trim(),
                type: a.type || "other",
                sortOrder: i,
              })),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to save brand");
        }
        void fetchBrand();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save brand",
        );
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
    if (!window.confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/brands/${id}`, {
        method: "DELETE",
        credentials: "include",
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
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !brand) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
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
          <h2 className="text-2xl font-semibold tracking-tight">
            Edit Brand
          </h2>
          <Link
            href="/brands"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to list
          </Link>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "Delete brand"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Brand details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className={labelClass}>
                  Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. PacSafe"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="slug" className={labelClass}>
                  Slug
                </label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="websiteUrl" className={labelClass}>
                Website URL
              </label>
              <input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className={inputClass}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={cn(inputClass, "resize-y")}
                placeholder="Brief description of what the brand offers"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="logoUrl" className={labelClass}>
                Logo URL
              </label>
              <input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className={inputClass}
                placeholder="https://…"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="featured"
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <label htmlFor="featured" className="text-sm font-medium">
                Featured Brand
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Brand assets (logos, banners)</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAsset}
                >
                  + Add asset
                </Button>
              </div>
              <input
                ref={uploadAssetInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                aria-hidden
                onChange={handleUploadAsset}
              />
              {assets.length > 0 && (
                <ul className="space-y-2">
                  {assets.map((a, i) => (
                    <li
                      key={a.id ?? i}
                      className="flex flex-wrap items-center gap-2 rounded border p-2"
                    >
                      <input
                        type="url"
                        value={a.url}
                        onChange={(e) => updateAsset(i, "url", e.target.value)}
                        className={cn(inputClass, "min-w-[200px] flex-1")}
                        placeholder="Image URL"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 shrink-0"
                        disabled={uploadAssetLoading}
                        onClick={() => triggerUploadAsset(i)}
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </Button>
                      <select
                        value={a.type}
                        onChange={(e) => updateAsset(i, "type", e.target.value)}
                        className={cn(inputClass, "w-28")}
                      >
                        <option value="logo">Logo</option>
                        <option value="banner">Banner</option>
                        <option value="other">Other</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAsset(i)}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
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
