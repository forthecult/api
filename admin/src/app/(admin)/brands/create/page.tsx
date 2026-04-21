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

interface AssetRow {
  type: string;
  url: string;
}

export default function AdminBrandsCreatePage() {
  const router = useRouter();
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);

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
      if (!name.trim()) {
        setError("Name is required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/brands`, {
          body: JSON.stringify({
            description: description.trim() || undefined,
            featured,
            logoUrl: logoUrl.trim() || undefined,
            name: name.trim(),
            slug: slug.trim() || undefined,
            websiteUrl: websiteUrl.trim() || undefined,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to create brand");
        }
        const json = (await res.json()) as { id: string };
        if (assets.some((a) => a.url.trim())) {
          for (let i = 0; i < assets.length; i++) {
            const a = assets[i];
            if (!a.url.trim()) continue;
            await fetch(`${API_BASE}/api/admin/brands/${json.id}/assets`, {
              body: JSON.stringify({
                sortOrder: i,
                type: a.type || "other",
                url: a.url.trim(),
              }),
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              method: "POST",
            });
          }
        }
        router.push("/brands");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create brand");
      } finally {
        setSaving(false);
      }
    },
    [name, slug, websiteUrl, description, featured, logoUrl, assets, router],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Create New Brand
        </h2>
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
                  placeholder="Auto-generated from name if empty"
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
                placeholder="https://… or upload in main app Dashboard → Uploads, then paste URL here"
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
              <p className="text-xs text-muted-foreground">
                Upload to UploadThing or paste image URLs.
              </p>
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
                      key={i}
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
