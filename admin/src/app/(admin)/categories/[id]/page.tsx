"use client";

import { Layers, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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

interface Category {
  description: null | string;
  featured: boolean;
  id: string;
  imageUrl: null | string;
  level: number;
  metaDescription: null | string;
  name: string;
  parentId: null | string;
  seoOptimized?: boolean;
  slug: null | string;
  title: null | string;
  tokenGated?: boolean;
  tokenGates?: TokenGateRow[];
  visible?: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default function AdminCategoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [category, setCategory] = useState<Category | null>(null);
  const [parentOptions, setParentOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
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
  const [visible, setVisible] = useState(true);
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
  const [bulkResult, setBulkResult] = useState<null | {
    added: number;
    message: string;
    skipped: number;
    totalMatched: number;
  }>(null);
  interface AutoAssignRule {
    brand: null | string;
    createdWithinDays: null | number;
    enabled: boolean;
    id: string;
    tagContains: null | string;
    titleContains: null | string;
  }
  const [savedRules, setSavedRules] = useState<AutoAssignRule[]>([]);
  const [deletingRuleId, setDeletingRuleId] = useState<null | string>(null);
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
      setSeoOptimized(
        (data as { seoOptimized?: boolean }).seoOptimized ?? false,
      );
      setImageUrl(data.imageUrl ?? "");
      setLevel(data.level);
      setFeatured(data.featured);
      setVisible(data.visible ?? true);
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
        body: form,
        credentials: "include",
        method: "POST",
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
      if (file?.type.startsWith("image/")) uploadImageFile(file);
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
          body: JSON.stringify({
            description: description.trim() || null,
            featured,
            imageUrl: imageUrl.trim() || null,
            level,
            metaDescription: metaDescription.trim() || null,
            name: name.trim() || undefined,
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
          method: "PATCH",
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
      visible,
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
    if (!titleContains && createdWithinDays == null && !brand && !tagContains) {
      setBulkResult({
        added: 0,
        message: "Provide at least one filter.",
        skipped: 0,
        totalMatched: 0,
      });
      return;
    }
    if (
      createdWithinDays != null &&
      (Number.isNaN(createdWithinDays) || createdWithinDays < 1)
    ) {
      setBulkResult({
        added: 0,
        message: "Created within days must be a positive number.",
        skipped: 0,
        totalMatched: 0,
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
          body: JSON.stringify({
            brand: brand ?? undefined,
            createdWithinDays: createdWithinDays ?? undefined,
            perpetual: bulkPerpetual,
            tagContains: tagContains ?? undefined,
            titleContains: titleContains || undefined,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: ac.signal,
        },
      );
      let data: {
        added?: number;
        error?: string;
        message?: string;
        perpetualSaved?: boolean;
        skipped?: number;
        totalMatched?: number;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setBulkResult({
          added: 0,
          message: "Invalid response from server.",
          skipped: 0,
          totalMatched: 0,
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
              : (data.error ?? "Failed to add products");
        setBulkResult({
          added: 0,
          message: msg,
          skipped: 0,
          totalMatched: 0,
        });
        return;
      }
      setBulkResult({
        added: data.added ?? 0,
        message: data.message ?? "Done.",
        skipped: data.skipped ?? 0,
        totalMatched: data.totalMatched ?? 0,
      });
      void fetchCategory();
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setBulkResult({
        added: 0,
        message: isAbort
          ? "Request timed out. Try fewer filters or try again."
          : "Request failed. Ensure the main store (e.g. localhost:3000) is running.",
        skipped: 0,
        totalMatched: 0,
      });
    } finally {
      clearTimeout(timeoutId);
      bulkAddAbortRef.current = null;
      setBulkAdding(false);
    }
  }, [
    id,
    bulkTitleContains,
    bulkCreatedWithinDays,
    bulkBrand,
    bulkTagContains,
    bulkPerpetual,
    fetchCategory,
    fetchAutoAssignRules,
  ]);

  const handleCancelBulkAdd = useCallback(() => {
    bulkAddAbortRef.current?.abort();
    setBulkAdding(false);
    setBulkRunningSaved(false);
    setBulkResult({
      added: 0,
      message: "Cancelled.",
      skipped: 0,
      totalMatched: 0,
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
          body: JSON.stringify({ runPerpetualRules: true }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: ac.signal,
        },
      );
      let data: {
        added?: number;
        error?: string;
        message?: string;
        skipped?: number;
        totalMatched?: number;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setBulkResult({
          added: 0,
          message: "Invalid response from server.",
          skipped: 0,
          totalMatched: 0,
        });
        return;
      }
      if (!res.ok) {
        const msg =
          res.status === 401
            ? "Unauthorized. Sign in again at the main store (e.g. localhost:3000)."
            : res.status === 403
              ? "Forbidden. Your account may not have admin access."
              : (data.error ?? "Failed to add products");
        setBulkResult({
          added: 0,
          message: msg,
          skipped: 0,
          totalMatched: 0,
        });
        return;
      }
      setBulkResult({
        added: data.added ?? 0,
        message: data.message ?? "Done.",
        skipped: data.skipped ?? 0,
        totalMatched: data.totalMatched ?? 0,
      });
      void fetchCategory();
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      setBulkResult({
        added: 0,
        message: isAbort
          ? "Request timed out. Try again."
          : "Request failed. Ensure the main store (e.g. localhost:3000) is running.",
        skipped: 0,
        totalMatched: 0,
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
          { credentials: "include", method: "DELETE" },
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
        credentials: "include",
        method: "DELETE",
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
      <div
        className={`
          flex min-h-[200px] items-center justify-center text-muted-foreground
        `}
      >
        Loading…
      </div>
    );
  }

  if (error && !category) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/categories"
        >
          ← Back to list
        </Link>
        <div
          className={`
            rounded-lg border border-red-200 bg-red-50 p-4 text-red-800
            dark:border-red-800 dark:bg-red-950/30 dark:text-red-200
          `}
        >
          {error}
        </div>
      </div>
    );
  }

  // Storefront category URLs are /{slug}; use form slug so View link updates when slug is changed
  const storefrontCategoryUrl =
    slug?.trim() || category?.slug?.trim()
      ? `${API_BASE}/${slug.trim() || category?.slug?.trim()}`
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
            Edit Category
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
          {storefrontCategoryUrl ? (
            <a
              className={`
                text-sm font-medium text-primary
                hover:underline
              `}
              href={storefrontCategoryUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              View category ↗
            </a>
          ) : null}
        </div>
        <Button
          aria-label="Delete category"
          className="gap-2"
          disabled={deleting}
          onClick={handleDelete}
          type="button"
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete category
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers aria-hidden className="size-5" />
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
              <p
                className={`
                  font-medium text-green-800
                  dark:text-green-200
                `}
              >
                Active perpetual rules ({savedRules.length}) — saved for future
                products
              </p>
              <p className="text-sm text-muted-foreground">
                New and updated products are automatically added to this
                category when they match any rule below, and removed when they
                no longer match.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={bulkRunningSaved || bulkAdding}
                  onClick={handleRunSavedRules}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {bulkRunningSaved
                    ? "Adding…"
                    : "Add products matching saved rules"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Adds existing products that match any rule below (OR).
                </span>
              </div>
              <ul className="space-y-2">
                {savedRules.map((rule) => (
                  <li
                    className={`
                      flex flex-wrap items-center justify-between gap-2
                      rounded-lg border border-green-200 bg-green-50 p-3 text-sm
                      text-green-800
                      dark:border-green-800 dark:bg-green-950/30
                      dark:text-green-200
                    `}
                    key={rule.id}
                  >
                    <ul className="list-inside list-disc space-y-0.5">
                      {rule.titleContains && (
                        <li>
                          Title contains: &quot;{rule.titleContains}&quot;
                        </li>
                      )}
                      {rule.createdWithinDays != null && (
                        <li>
                          Created within last {rule.createdWithinDays} days
                        </li>
                      )}
                      {rule.brand && <li>Brand: {rule.brand}</li>}
                      {rule.tagContains && (
                        <li>Tag contains: &quot;{rule.tagContains}&quot;</li>
                      )}
                    </ul>
                    <Button
                      aria-label={`Remove rule ${rule.id}`}
                      className={`
                        shrink-0 text-red-600
                        hover:text-red-700
                        dark:text-red-400 dark:hover:text-red-300
                      `}
                      disabled={deletingRuleId === rule.id}
                      onClick={() => handleDeleteRule(rule.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
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
          <div
            className={`
              grid gap-4
              sm:grid-cols-2
              lg:grid-cols-4
            `}
          >
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bulk-title">
                Product title contains
              </label>
              <input
                className={inputClass}
                id="bulk-title"
                onChange={(e) => setBulkTitleContains(e.target.value)}
                placeholder="e.g. Bitcoin"
                type="text"
                value={bulkTitleContains}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bulk-days">
                Created within last (days)
              </label>
              <input
                className={inputClass}
                id="bulk-days"
                min={1}
                onChange={(e) => setBulkCreatedWithinDays(e.target.value)}
                placeholder="e.g. 30"
                type="number"
                value={bulkCreatedWithinDays}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bulk-brand">
                Brand
              </label>
              <input
                className={inputClass}
                id="bulk-brand"
                onChange={(e) => setBulkBrand(e.target.value)}
                placeholder="e.g. TechPro"
                type="text"
                value={bulkBrand}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="bulk-tag">
                Product tag contains
              </label>
              <input
                className={inputClass}
                id="bulk-tag"
                onChange={(e) => setBulkTagContains(e.target.value)}
                placeholder="e.g. supplement"
                type="text"
                value={bulkTagContains}
              />
              <p className="text-xs text-muted-foreground">
                Products with at least one tag containing this text
                (case-insensitive).
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={bulkPerpetual}
                  className="rounded border-input"
                  onChange={(e) => setBulkPerpetual(e.target.checked)}
                  type="checkbox"
                />
                Also apply to new/imported products (perpetual rule)
              </label>
              <Button
                disabled={bulkAdding || bulkRunningSaved}
                onClick={handleBulkAdd}
                type="button"
                variant="secondary"
              >
                {bulkAdding || bulkRunningSaved
                  ? "Adding…"
                  : "Add matching products"}
              </Button>
              {(bulkAdding || bulkRunningSaved) && (
                <Button
                  onClick={handleCancelBulkAdd}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              When the perpetual rule box is checked, the rule is saved even if
              no products match now. Saved rules appear in the green box above.
              Main store (e.g. localhost:3000) must be running.
            </p>
          </div>
          {bulkResult && (
            <p
              className={cn(
                "text-sm",
                bulkResult.added > 0
                  ? `
                    text-green-700
                    dark:text-green-400
                  `
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
                accept="image/jpeg,image/png,image/webp,image/gif"
                aria-hidden
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadImageFile(file);
                }}
                ref={imageInputRef}
                type="file"
              />
              <div
                className={cn(
                  "rounded-md border-2 border-dashed p-4 transition-colors",
                  imageDropActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30",
                )}
                onDragLeave={handleImageDragLeave}
                onDragOver={handleImageDragOver}
                onDrop={handleImageDrop}
              >
                <input
                  className={inputClass}
                  id="imageUrl"
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://… or drop image here"
                  type="url"
                  value={imageUrl}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    className="gap-1"
                    disabled={imageUploading}
                    onClick={() => imageInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4" />
                    {imageUploading ? "Uploading…" : "Upload"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Drop an image here or paste a URL. Uploads are optimized for
                    web.
                  </span>
                </div>
              </div>
              {imageUrl && (
                <div className="relative mt-2 flex items-center gap-3">
                  <div
                    className={`
                      relative size-20 shrink-0 overflow-hidden rounded-md
                      border bg-muted
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
                  <span className="text-xs text-muted-foreground">Preview</span>
                </div>
              )}
            </div>

            <div
              className={`
                grid gap-6
                sm:grid-cols-2
              `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="level">
                  Level
                </label>
                <input
                  className={inputClass}
                  id="level"
                  min={1}
                  onChange={(e) =>
                    setLevel(Number.parseInt(e.target.value, 10) || 1)
                  }
                  type="number"
                  value={level}
                />
              </div>
              <div className="flex items-center gap-4 pt-8">
                <div className="flex items-center gap-2">
                  <input
                    checked={visible}
                    className={cn(
                      `
                        size-4 rounded border-input text-primary
                        focus:ring-ring
                      `,
                    )}
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
                    className={cn(
                      `
                        size-4 rounded border-input text-primary
                        focus:ring-ring
                      `,
                    )}
                    id="featured"
                    onChange={(e) => setFeatured(e.target.checked)}
                    type="checkbox"
                  />
                  <label className="text-sm font-medium" htmlFor="featured">
                    Featured category
                  </label>
                </div>
              </div>
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
                    Meta description
                  </label>
                  <textarea
                    className={cn(inputClass, "resize-y")}
                    id="metaDescription"
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Short summary for search results (e.g. 150–160 chars)"
                    rows={2}
                    value={metaDescription}
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
