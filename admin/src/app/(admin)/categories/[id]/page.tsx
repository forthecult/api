"use client";

import { Layers, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

type Category = {
  id: string;
  name: string;
  slug: string | null;
  title: string | null;
  metaDescription: string | null;
  description: string | null;
  imageUrl: string | null;
  level: number;
  featured: boolean;
  seoOptimized?: boolean;
  parentId: string | null;
  tokenGated?: boolean;
  tokenGates?: TokenGateRow[];
};

type CategoryOption = { id: string; name: string };

export default function AdminCategoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [category, setCategory] = useState<Category | null>(null);
  const [parentOptions, setParentOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [description, setDescription] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [level, setLevel] = useState(1);
  const [featured, setFeatured] = useState(false);
  const [parentId, setParentId] = useState("");
  const [tokenGated, setTokenGated] = useState(false);
  const [tokenGates, setTokenGates] = useState<TokenGateRow[]>([]);

  const [bulkTitleContains, setBulkTitleContains] = useState("");
  const [bulkCreatedWithinDays, setBulkCreatedWithinDays] = useState("");
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkTagContains, setBulkTagContains] = useState("");
  const [bulkPerpetual, setBulkPerpetual] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkRunningSaved, setBulkRunningSaved] = useState(false);
  const bulkAddAbortRef = useRef<AbortController | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    added: number;
    skipped: number;
    totalMatched: number;
    message: string;
  } | null>(null);
  type AutoAssignRule = {
    id: string;
    titleContains: string | null;
    createdWithinDays: number | null;
    brand: string | null;
    tagContains: string | null;
    enabled: boolean;
  };
  const [savedRules, setSavedRules] = useState<AutoAssignRule[]>([]);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDropActive, setImageDropActive] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchCategory = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Category not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Category;
      setCategory(data);
      setName(data.name);
      setSlug(data.slug ?? "");
      setTitle(data.title ?? "");
      setMetaDescription(data.metaDescription ?? "");
      setDescription(data.description ?? "");
      setSeoOptimized((data as { seoOptimized?: boolean }).seoOptimized ?? false);
      setImageUrl(data.imageUrl ?? "");
      setLevel(data.level);
      setFeatured(data.featured);
      setParentId(data.parentId ?? "");
      setTokenGated(data.tokenGated ?? false);
      setTokenGates(
        Array.isArray((data as { tokenGates?: TokenGateRow[] }).tokenGates)
          ? (data as { tokenGates: TokenGateRow[] }).tokenGates
          : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load category");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchParentOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories?limit=200`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { items: CategoryOption[] };
      setParentOptions(json.items.filter((c) => c.id !== id));
    } catch {
      // non-blocking
    }
  }, [id]);

  const fetchAutoAssignRules = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/categories/${id}/auto-assign-rule`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { rules: AutoAssignRule[] };
      setSavedRules(Array.isArray(json.rules) ? json.rules : []);
    } catch {
      // non-blocking
    }
  }, [id]);

  useEffect(() => {
    void fetchCategory();
    void fetchParentOptions();
  }, [fetchCategory, fetchParentOptions]);

  useEffect(() => {
    if (id) void fetchAutoAssignRules();
  }, [id, fetchAutoAssignRules]);

  const uploadImageFile = useCallback(async (file: File) => {
    setImageUploading(true);
    setError(null);
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
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploading(false);
    }
  }, []);

  const handleImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setImageDropActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) uploadImageFile(file);
    },
    [uploadImageFile],
  );

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDropActive(true);
  }, []);

  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImageDropActive(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: name.trim() || undefined,
            slug: slug.trim() || null,
            title: title.trim() || null,
            metaDescription: metaDescription.trim() || null,
            description: description.trim() || null,
            seoOptimized,
            imageUrl: imageUrl.trim() || null,
            level,
            featured,
            parentId: parentId || null,
            tokenGated,
            tokenGates,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to save");
        }
        const updated = (await res.json()) as Category;
        setCategory((prev) => (prev ? { ...prev, ...updated } : prev));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      name,
      slug,
      title,
      metaDescription,
      description,
      seoOptimized,
      imageUrl,
      level,
      featured,
      parentId,
      tokenGated,
      tokenGates,
    ],
  );

  const handleBulkAdd = useCallback(async () => {
    if (!id) return;
    const titleContains = bulkTitleContains.trim();
    const createdWithinDays = bulkCreatedWithinDays.trim()
      ? Number.parseInt(bulkCreatedWithinDays, 10)
      : null;
    const brand = bulkBrand.trim() || null;
    const tagContains = bulkTagContains.trim() || null;
    if (
      !titleContains &&
      createdWithinDays == null &&
      !brand &&
      !tagContains
    ) {
      setBulkResult({
        added: 0,
        skipped: 0,
        totalMatched: 0,
        message: "Provide at least one filter.",
      });
      return;
    }
    if (
      createdWithinDays != null &&
      (Number.isNaN(createdWithinDays) || createdWithinDays < 1)
    ) {
      setBulkResult({
        added: 0,
        skipped: 0,
        totalMatched: 0,
        message: "Created within days must be a positive number.",
      });
      return;
    }
    setBulkAdding(true);
    setBulkResult(null);
    const ac = new AbortController();
    bulkAddAbortRef.current = ac;
    const timeoutId = setTimeout(() => ac.abort(), 90_000);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/categories/${id}/bulk-add-products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            titleContains: titleContains || undefined,
            createdWithinDays: createdWithinDays ?? undefined,
            brand: brand ?? undefined,
            tagContains: tagContains ?? undefined,
            perpetual: bulkPerpetual,
          }),
          signal: ac.signal,
        },
      );
      let data: {
        added?: number;
        skipped?: number;
        totalMatched?: number;
        perpetualSaved?: boolean;
        message?: string;
        error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setBulkResult({
          added: 0,
          skipped: 0,
          totalMatched: 0,
          message: "Invalid response from server.",
        });
        return;
      }
      if (data.perpetualSaved) {
        void fetchAutoAssignRules();
      }
      if (!res.ok) {
        const msg =
          res.status === 401
            ? "Unauthorized. Sign in again at the main store (e.g. localhost:3000)."
            : res.status === 403
              ? "Forbidden. Your account may not have admin access."
              : data.error ?? "Failed to add products";
        setBulkResult({
          added: 0,
          skipped: 0,
          totalMatched: 0,
          message: msg,
        });
        return;
      }
      setBulkResult({
        added: data.added ?? 0,
        skipped: data.skipped ?? 0,
        totalMatched: data.totalMatched ?? 0,
        message: data.message ?? "Done.",
      });
      void fetchCategory();
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setBulkResult({
        added: 0,
        skipped: 0,
        totalMatched: 0,
        message: isAbort ? "Request timed out. Try fewer filters or try again." : "Request failed. Ensure the main store (e.g. localhost:3000) is running.",
      });
    } finally {
      clearTimeout(timeoutId);
      bulkAddAbortRef.current = null;
      setBulkAdding(false);
    }
  }, [id, bulkTitleContains, bulkCreatedWithinDays, bulkBrand, bulkTagContains, bulkPerpetual, fetchCategory, fetchAutoAssignRules]);

  const handleCancelBulkAdd = useCallback(() => {
    bulkAddAbortRef.current?.abort();
    setBulkAdding(false);
    setBulkRunningSaved(false);
    setBulkResult({
      added: 0,
      skipped: 0,
      totalMatched: 0,
      message: "Cancelled.",
    });
  }, []);

  const handleRunSavedRules = useCallback(async () => {
    if (!id) return;
    setBulkRunningSaved(true);
    setBulkResult(null);
    const ac = new AbortController();
    bulkAddAbortRef.current = ac;
    const timeoutId = setTimeout(() => ac.abort(), 90_000);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/categories/${id}/bulk-add-products`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ runPerpetualRules: true }),
          signal: ac.signal,
        },
      );
      let data: {
        added?: number;
        skipped?: number;
        totalMatched?: number;
        message?: string;
        error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setBulkResult({
          added: 0,
          skipped: 0,
          totalMatched: 0,
          message: "Invalid response from server.",
        });
        return;
      }
      if (!res.ok) {
        const msg =
          res.status === 401
            ? "Unauthorized. Sign in again at the main store (e.g. localhost:3000)."
            : res.status === 403
              ? "Forbidden. Your account may not have admin access."
              : data.error ?? "Failed to add products";
        setBulkResult({
          added: 0,
          skipped: 0,
          totalMatched: 0,
          message: msg,
        });
        return;
      }
      setBulkResult({
        added: data.added ?? 0,
        skipped: data.skipped ?? 0,
        totalMatched: data.totalMatched ?? 0,
        message: data.message ?? "Done.",
      });
      void fetchCategory();
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setBulkResult({
        added: 0,
        skipped: 0,
        totalMatched: 0,
        message: isAbort ? "Request timed out. Try again." : "Request failed. Ensure the main store (e.g. localhost:3000) is running.",
      });
    } finally {
      clearTimeout(timeoutId);
      bulkAddAbortRef.current = null;
      setBulkRunningSaved(false);
    }
  }, [id, fetchCategory]);

  const handleDeleteRule = useCallback(
    async (ruleId: string) => {
      if (!id) return;
      setDeletingRuleId(ruleId);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/categories/${id}/auto-assign-rule?ruleId=${encodeURIComponent(ruleId)}`,
          { method: "DELETE", credentials: "include" },
        );
        if (res.ok) void fetchAutoAssignRules();
      } finally {
        setDeletingRuleId(null);
      }
    },
    [id, fetchAutoAssignRules],
  );

  const handleDelete = useCallback(async () => {
    if (!id || !category) return;
    if (
      !window.confirm(
        `Delete category "${category.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete");
      }
      router.push("/categories");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }, [id, category, router]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !category) {
    return (
      <div className="space-y-4">
        <Link
          href="/categories"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to list
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  // Storefront category URLs are /{slug}; use form slug so View link updates when slug is changed
  const storefrontCategoryUrl =
    (slug?.trim() || category?.slug?.trim())
      ? `${API_BASE}/${slug.trim() || category?.slug?.trim()}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Edit Category
          </h2>
          <Link
            href="/categories"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to list
          </Link>
          {storefrontCategoryUrl ? (
            <a
              href={storefrontCategoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              View category ↗
            </a>
          ) : null}
        </div>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={deleting}
          onClick={handleDelete}
          aria-label="Delete category"
        >
          <Trash2 className="size-4" />
          Delete category
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-5" aria-hidden />
            Bulk add products
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Add products to this category by filters. At least one filter is
            required. Products already in the category are skipped.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedRules.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-green-800 dark:text-green-200">
                Active perpetual rules ({savedRules.length}) — saved for future products
              </p>
              <p className="text-sm text-muted-foreground">
                New and updated products are automatically added to this category when they match any rule below, and removed when they no longer match.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={bulkRunningSaved || bulkAdding}
                  onClick={handleRunSavedRules}
                >
                  {bulkRunningSaved ? "Adding…" : "Add products matching saved rules"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Adds existing products that match any rule below (OR).
                </span>
              </div>
              <ul className="space-y-2">
                {savedRules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  >
                    <ul className="list-inside list-disc space-y-0.5">
                      {rule.titleContains && (
                        <li>Title contains: &quot;{rule.titleContains}&quot;</li>
                      )}
                      {rule.createdWithinDays != null && (
                        <li>Created within last {rule.createdWithinDays} days</li>
                      )}
                      {rule.brand && (
                        <li>Brand: {rule.brand}</li>
                      )}
                      {rule.tagContains && (
                        <li>Tag contains: &quot;{rule.tagContains}&quot;</li>
                      )}
                    </ul>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingRuleId === rule.id}
                      onClick={() => handleDeleteRule(rule.id)}
                      className="shrink-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      aria-label={`Remove rule ${rule.id}`}
                    >
                      {deletingRuleId === rule.id ? (
                        "Removing…"
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="bulk-title" className={labelClass}>
                Product title contains
              </label>
              <input
                id="bulk-title"
                type="text"
                placeholder="e.g. Bitcoin"
                value={bulkTitleContains}
                onChange={(e) => setBulkTitleContains(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-days" className={labelClass}>
                Created within last (days)
              </label>
              <input
                id="bulk-days"
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={bulkCreatedWithinDays}
                onChange={(e) => setBulkCreatedWithinDays(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-brand" className={labelClass}>
                Brand
              </label>
              <input
                id="bulk-brand"
                type="text"
                placeholder="e.g. TechPro"
                value={bulkBrand}
                onChange={(e) => setBulkBrand(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="bulk-tag" className={labelClass}>
                Product tag contains
              </label>
              <input
                id="bulk-tag"
                type="text"
                placeholder="e.g. supplement"
                value={bulkTagContains}
                onChange={(e) => setBulkTagContains(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Products with at least one tag containing this text (case-insensitive).
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkPerpetual}
                  onChange={(e) => setBulkPerpetual(e.target.checked)}
                  className="rounded border-input"
                />
                Also apply to new/imported products (perpetual rule)
              </label>
              <Button
              type="button"
              variant="secondary"
              disabled={bulkAdding || bulkRunningSaved}
              onClick={handleBulkAdd}
            >
              {bulkAdding || bulkRunningSaved ? "Adding…" : "Add matching products"}
            </Button>
              {(bulkAdding || bulkRunningSaved) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelBulkAdd}
                >
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              When the perpetual rule box is checked, the rule is saved even if no products match now. Saved rules appear in the green box above. Main store (e.g. localhost:3000) must be running.
            </p>
          </div>
          {bulkResult && (
            <p
              className={cn(
                "text-sm",
                bulkResult.added > 0
                  ? "text-green-700 dark:text-green-400"
                  : "text-muted-foreground",
              )}
            >
              {bulkResult.message}
              {bulkResult.totalMatched > 0 && (
                <span className="ml-1">
                  ({bulkResult.added} added, {bulkResult.skipped} already in
                  category)
                </span>
              )}
              {(bulkResult as { perpetualSaved?: boolean }).perpetualSaved && (
                <span className="ml-1">Perpetual rule saved.</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

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
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                aria-hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadImageFile(file);
                }}
              />
              <div
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
                className={cn(
                  "rounded-md border-2 border-dashed p-4 transition-colors",
                  imageDropActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30",
                )}
              >
                <input
                  id="imageUrl"
                  type="url"
                  placeholder="https://… or drop image here"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className={inputClass}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={imageUploading}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {imageUploading ? "Uploading…" : "Upload"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Drop an image here or paste a URL. Uploads are optimized for web.
                  </span>
                </div>
              </div>
              {imageUrl && (
                <div className="relative mt-2 flex items-center gap-3">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-md border bg-muted">
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
                  <span className="text-xs text-muted-foreground">
                    Preview
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="level" className={labelClass}>
                  Level
                </label>
                <input
                  id="level"
                  type="number"
                  min={1}
                  value={level}
                  onChange={(e) =>
                    setLevel(Number.parseInt(e.target.value, 10) || 1)
                  }
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <input
                  id="featured"
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className={cn(
                    "size-4 rounded border-input text-primary focus:ring-ring",
                  )}
                />
                <label htmlFor="featured" className="text-sm font-medium">
                  Featured category
                </label>
              </div>
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
                    Meta description
                  </label>
                  <textarea
                    id="metaDescription"
                    placeholder="Short summary for search results (e.g. 150–160 chars)"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    className={cn(inputClass, "resize-y")}
                  />
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

            <div className="flex gap-2 border-t pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Link
                href="/categories"
                className={cn(
                  "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground",
                )}
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
