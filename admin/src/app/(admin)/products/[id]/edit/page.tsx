"use client";

import {
  CloudUpload,
  GripVertical,
  ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TokenGateRow } from "~/ui/token-gates-list";

import { cn } from "~/lib/cn";
import {
  COUNTRIES_BY_CONTINENT,
  COUNTRY_ORIGIN_OPTIONS,
} from "~/lib/countries-by-continent";
import { getAdminApiBaseUrl } from "~/lib/env";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { BrandSelect } from "~/ui/brand-select";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { CategorySelect } from "~/ui/category-select";
import { TokenGatesList } from "~/ui/token-gates-list";

const API_BASE = getAdminApiBaseUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

// Common option names for the dropdown
const OPTION_NAME_SUGGESTIONS = ["Size", "Color", "Material", "Style"];

interface CategoryOption {
  id: string;
  name: string;
  parentName?: null | string;
  slug?: null | string;
}
interface OptionDef {
  isExpanded?: boolean;
  name: string;
  values: string[];
}
interface Product {
  availableCountryCodes?: string[];
  barcode: null | string;
  brand: null | string;
  categoryId: null | string;
  categoryIds?: string[];
  compareAtPriceCents: null | number;
  continueSellingWhenOutOfStock: boolean;
  costPerItemCents: null | number;
  countryOfOrigin: null | string;
  description: null | string;
  features?: string[];
  hasVariants: boolean;
  hidden: boolean;
  hsCode: null | string;
  id: string;
  images: ProductImage[];
  imageUrl: null | string;
  mainCategoryId?: null | string;
  mainImageAlt?: null | string;
  mainImageTitle?: null | string;
  metaDescription: null | string;
  model: null | string;
  name: string;
  optionDefinitionsJson: null | string;
  pageTitle: null | string;
  physicalProduct: boolean;
  priceCents: number;
  published: boolean;
  quantity: null | number;
  seoOptimized: boolean;
  shipsFromCity: null | string;
  shipsFromCountry: null | string;
  shipsFromDisplay: null | string;
  shipsFromPostalCode: null | string;
  shipsFromRegion: null | string;
  sku: null | string;
  slug: null | string;
  /** "manual" | "printful" | "printify" – used to show the correct sync button. */
  source?: null | string;
  tags: string[];
  tokenGated?: boolean;
  tokenGates?: TokenGateRow[];
  trackQuantity: boolean;
  variants: ProductVariant[];
  vendor: null | string;
  weightGrams: null | number;
  weightUnit: null | string;
}

interface ProductImage {
  alt?: string;
  id?: string;
  sortOrder?: number;
  title?: string;
  url: string;
}

interface ProductVariant {
  availabilityStatus?: null | string;
  color?: string;
  /** Catalog variant ID (Printful/Printify) – used for shipping rate calculation */
  externalId?: null | string;
  id?: string;
  imageAlt?: string;
  imageTitle?: string;
  imageUrl?: string;
  /** Display label (e.g. Printful variant name: "Product / Color / Size") */
  label?: string;
  optionValues?: Record<string, string>;
  priceCents: number;
  /** Printful sync_variant.id – set when synced from Printful */
  printfulSyncVariantId?: null | number;
  /** Printify variant id – set when synced from Printify */
  printifyVariantId?: null | string;
  size?: string;
  sku?: string;
  stockQuantity?: number;
}

export default function AdminProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [product, setProduct] = useState<null | Product>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [printfulResyncLoading, setPrintfulResyncLoading] = useState(false);
  const [printifyResyncLoading, setPrintifyResyncLoading] = useState(false);
  const [printifyConfirmPublishLoading, setPrintifyConfirmPublishLoading] =
    useState(false);
  const [printifyRegisterWebhooksLoading, setPrintifyRegisterWebhooksLoading] =
    useState(false);
  const [
    printifyDeleteAllWebhooksLoading,
    setPrintifyDeleteAllWebhooksLoading,
  ] = useState(false);
  const [printifyDeleteLoading, setPrintifyDeleteLoading] = useState(false);
  const [printifyIdToDelete, setPrintifyIdToDelete] = useState("");
  const [printifyIdToImport, setPrintifyIdToImport] = useState("");
  const [printifyImportLoading, setPrintifyImportLoading] = useState(false);
  const [uploadMockupsLoading, setUploadMockupsLoading] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  /** Kept for backwards compatibility; description is no longer in an accordion. */
  const _descriptionAccordionOpen = false;
  const [imageUrl, setImageUrl] = useState("");
  const [mainImageAlt, setMainImageAlt] = useState("");
  const [mainImageTitle, setMainImageTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(false);
  const [priceCents, setPriceCents] = useState("");
  const [compareAtPriceCents, setCompareAtPriceCents] = useState("");
  const [costPerItemCents, setCostPerItemCents] = useState("");
  const [published, setPublished] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [vendor, setVendor] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [physicalProduct, setPhysicalProduct] = useState(true);
  const [trackQuantity, setTrackQuantity] = useState(false);
  const [continueSellingWhenOutOfStock, setContinueSellingWhenOutOfStock] =
    useState(false);
  const [quantity, setQuantity] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [shipsFromDisplay, setShipsFromDisplay] = useState("");
  const [shipsFromCountry, setShipsFromCountry] = useState("");
  const [shipsFromRegion, setShipsFromRegion] = useState("");
  const [shipsFromCity, setShipsFromCity] = useState("");
  const [shipsFromPostalCode, setShipsFromPostalCode] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState("");
  const [addCategoryValue, setAddCategoryValue] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [optionDefinitions, setOptionDefinitions] = useState<OptionDef[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [editingVariantIndex, setEditingVariantIndex] = useState<null | number>(
    null,
  );
  const [tokenGated, setTokenGated] = useState(false);
  const [tokenGates, setTokenGates] = useState<TokenGateRow[]>([]);
  const tokenGatesRef = useRef<TokenGateRow[]>(tokenGates);
  tokenGatesRef.current = tokenGates;
  const skipNextTokenGatesFromFetch = useRef(false);
  const [availableCountryCodes, setAvailableCountryCodes] = useState<string[]>(
    [],
  );
  const [expandedImageUrl, setExpandedImageUrl] = useState<null | string>(null);
  const [primaryImageLoadError, setPrimaryImageLoadError] = useState(false);

  const availableCountrySet = useMemo(
    () => new Set(availableCountryCodes),
    [availableCountryCodes],
  );

  const setCountry = useCallback((code: string, checked: boolean) => {
    if (isShippingExcluded(code)) return; // No-ship countries cannot be selected
    setAvailableCountryCodes((prev) => {
      const set = new Set(prev);
      if (checked) set.add(code);
      else set.delete(code);
      return [...set];
    });
  }, []);

  const setContinent = useCallback(
    (continentIndex: number, checked: boolean) => {
      const entry = COUNTRIES_BY_CONTINENT[continentIndex];
      if (!entry) return;
      const codes = entry.countries
        .map((c) => c.code)
        .filter((c) => !isShippingExcluded(c));
      setAvailableCountryCodes((prev) => {
        const set = new Set(prev);
        for (const code of codes) {
          if (checked) set.add(code);
          else set.delete(code);
        }
        return [...set];
      });
    },
    [],
  );

  const isContinentFullySelected = useCallback(
    (continentIndex: number) => {
      const entry = COUNTRIES_BY_CONTINENT[continentIndex];
      if (!entry) return false;
      const selectable = entry.countries.filter(
        (c) => !isShippingExcluded(c.code),
      );
      return (
        selectable.length > 0 &&
        selectable.every((c) => availableCountrySet.has(c.code))
      );
    },
    [availableCountrySet],
  );
  const isContinentPartiallySelected = useCallback(
    (continentIndex: number) => {
      const entry = COUNTRIES_BY_CONTINENT[continentIndex];
      if (!entry) return false;
      const selectable = entry.countries.filter(
        (c) => !isShippingExcluded(c.code),
      );
      const count = selectable.filter((c) =>
        availableCountrySet.has(c.code),
      ).length;
      return count > 0 && count < selectable.length;
    },
    [availableCountrySet],
  );

  const formRef = useRef<HTMLFormElement>(null);
  const continentCheckboxRefs = useRef<Record<number, HTMLInputElement | null>>(
    {},
  );
  useEffect(() => {
    COUNTRIES_BY_CONTINENT.forEach((_, i) => {
      const el = continentCheckboxRefs.current[i];
      if (el) el.indeterminate = isContinentPartiallySelected(i);
    });
  }, [isContinentPartiallySelected]);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) {
          setError("Product not found.");
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Product;
      setProduct(data);
      setName(data.name);
      setDescription(data.description ?? "");
      setFeatures(Array.isArray(data.features) ? data.features : []);
      setImageUrl(data.imageUrl ?? "");
      setPrimaryImageLoadError(false);
      setMainImageAlt(
        (data as { mainImageAlt?: null | string }).mainImageAlt ?? "",
      );
      setMainImageTitle(
        (data as { mainImageTitle?: null | string }).mainImageTitle ?? "",
      );
      setMetaDescription(data.metaDescription ?? "");
      setPageTitle(data.pageTitle ?? "");
      setSeoOptimized(
        (data as { seoOptimized?: boolean }).seoOptimized ?? false,
      );
      setPriceCents(String(data.priceCents));
      setCompareAtPriceCents(
        data.compareAtPriceCents != null
          ? String(data.compareAtPriceCents)
          : "",
      );
      setCostPerItemCents(
        data.costPerItemCents != null ? String(data.costPerItemCents) : "",
      );
      setPublished(data.published);
      setHidden(data.hidden ?? false);
      setBrand(data.brand ?? "");
      setModel(data.model ?? "");
      setVendor(data.vendor ?? "");
      setSlug(data.slug ?? slugFromName(data.name));
      setSku(data.sku ?? "");
      setBarcode(data.barcode ?? "");
      if (data.weightGrams != null) {
        setWeightValue(
          data.weightUnit === "lb"
            ? (data.weightGrams / 453.592).toFixed(2)
            : (data.weightGrams / 1000).toFixed(2),
        );
        setWeightUnit((data.weightUnit as "kg" | "lb") || "kg");
      } else {
        setWeightValue("");
      }
      setPhysicalProduct(data.physicalProduct);
      setTrackQuantity(data.trackQuantity);
      setContinueSellingWhenOutOfStock(data.continueSellingWhenOutOfStock);
      setQuantity(data.quantity != null ? String(data.quantity) : "");
      setHsCode(data.hsCode ?? "");
      setCountryOfOrigin(data.countryOfOrigin ?? "");
      setShipsFromDisplay(data.shipsFromDisplay ?? "");
      setShipsFromCountry(data.shipsFromCountry ?? "");
      setShipsFromRegion(data.shipsFromRegion ?? "");
      setShipsFromCity(data.shipsFromCity ?? "");
      setShipsFromPostalCode(data.shipsFromPostalCode ?? "");
      setCategoryIds(
        Array.isArray(data.categoryIds) && data.categoryIds.length > 0
          ? data.categoryIds
          : data.categoryId
            ? [data.categoryId]
            : [],
      );
      setMainCategoryId(data.mainCategoryId ?? data.categoryId ?? "");
      setTagsInput(data.tags?.length ? data.tags.join(", ") : "");
      setImages(data.images?.length ? data.images : []);
      setHasVariants(data.hasVariants);
      // Load option definitions from saved JSON
      try {
        const parsed = data.optionDefinitionsJson
          ? JSON.parse(data.optionDefinitionsJson)
          : [];
        setOptionDefinitions(
          parsed.map((o: OptionDef) => ({ ...o, isExpanded: false })),
        );
      } catch {
        setOptionDefinitions([]);
      }
      setVariants(data.variants ?? []);
      setTokenGated(data.tokenGated ?? false);
      if (!skipNextTokenGatesFromFetch.current) {
        setTokenGates(
          Array.isArray((data as { tokenGates?: TokenGateRow[] }).tokenGates)
            ? (data as { tokenGates: TokenGateRow[] }).tokenGates
            : [],
        );
      }
      skipNextTokenGatesFromFetch.current = false;
      setAvailableCountryCodes(
        (data.availableCountryCodes ?? []).filter(
          (c) => !isShippingExcluded(c),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/categories?limit=200`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { items: CategoryOption[] };
      setCategoryOptions(json.items ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void fetchProduct();
    void fetchCategories();
  }, [fetchProduct, fetchCategories]);

  const handlePrintfulResync = useCallback(async () => {
    if (!product?.id) return;
    setPrintfulResyncLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printful/sync`, {
        body: JSON.stringify({
          action: "import_single",
          overwrite: true,
          productId: product.id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Re-sync failed");
      }
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-sync failed");
    } finally {
      setPrintfulResyncLoading(false);
    }
  }, [product?.id, fetchProduct]);

  const handlePrintifyResync = useCallback(async () => {
    if (!product?.id) return;
    setPrintifyResyncLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        body: JSON.stringify({
          action: "import_single",
          overwrite: true,
          productId: product.id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Re-sync failed");
      }
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-sync failed");
    } finally {
      setPrintifyResyncLoading(false);
    }
  }, [product?.id, fetchProduct]);

  const handlePrintifyConfirmPublish = useCallback(async () => {
    if (!product?.id) return;
    setPrintifyConfirmPublishLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        body: JSON.stringify({
          action: "confirm_publish",
          productId: product.id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Confirm publish failed");
      }
      setError(null);
      if (json.message) {
        setError(null);
        // Show success briefly (or could use a toast)
        console.log("Printify confirm publish:", json.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm publish failed");
    } finally {
      setPrintifyConfirmPublishLoading(false);
    }
  }, [product?.id]);

  const handlePrintifyRegisterWebhooks = useCallback(async () => {
    setPrintifyRegisterWebhooksLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/webhooks`, {
        body: JSON.stringify({ action: "register_all" }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        registered?: number;
        success?: boolean;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Register webhooks failed");
      }
      if (json.message) {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register webhooks failed");
    } finally {
      setPrintifyRegisterWebhooksLoading(false);
    }
  }, []);

  const handlePrintifyDeleteAllWebhooks = useCallback(async () => {
    if (
      !window.confirm(
        "Delete all webhooks for this Printify shop? This removes every registered webhook (including staging). Then register from production so products go to production only.",
      )
    ) {
      return;
    }
    setPrintifyDeleteAllWebhooksLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/webhooks`, {
        body: JSON.stringify({ action: "delete_all" }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        error?: string;
        success?: boolean;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete all webhooks failed");
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete all webhooks failed",
      );
    } finally {
      setPrintifyDeleteAllWebhooksLoading(false);
    }
  }, []);

  const handleDeleteFromPrintify = useCallback(async () => {
    if (!product?.id) return;
    if (
      !window.confirm(
        "Delete this product in Printify? This will remove it from your Printify catalog and unlink it here (product will be unpublished). Use this to unstick products stuck in Publishing.",
      )
    ) {
      return;
    }
    setPrintifyDeleteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        body: JSON.stringify({
          action: "delete_in_printify",
          productId: product.id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Delete in Printify failed");
      }
      await fetchProduct();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete in Printify failed",
      );
    } finally {
      setPrintifyDeleteLoading(false);
    }
  }, [product?.id, fetchProduct]);

  const handleDeleteInPrintifyById = useCallback(async () => {
    const id = printifyIdToDelete.trim();
    if (!id) return;
    if (
      !window.confirm(
        `Delete product ${id} in Printify? This removes it from your Printify catalog. Use for products stuck in Publishing that are not in this store yet.`,
      )
    ) {
      return;
    }
    setPrintifyDeleteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        body: JSON.stringify({
          action: "delete_in_printify",
          printifyProductId: id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Delete in Printify failed");
      }
      setPrintifyIdToDelete("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete in Printify failed",
      );
    } finally {
      setPrintifyDeleteLoading(false);
    }
  }, [printifyIdToDelete]);

  const handleImportPrintifyById = useCallback(async () => {
    const id = printifyIdToImport.trim();
    if (!id) return;
    setPrintifyImportLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printify/sync`, {
        body: JSON.stringify({
          action: "import_single",
          overwrite: false,
          printifyProductId: id,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        productId?: string;
        success?: boolean;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Import failed");
      }
      setPrintifyIdToImport("");
      if (json.productId) {
        const base = window.location.pathname
          .replace(/[^/]+\/?$/, "")
          .replace(/\/$/, "");
        window.location.pathname = `${base}/${json.productId}`;
      } else {
        await fetchProduct();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPrintifyImportLoading(false);
    }
  }, [printifyIdToImport, fetchProduct]);

  const handleUploadMockups = useCallback(async () => {
    if (!id) return;
    setUploadMockupsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products/${id}/upload-mockups`,
        {
          credentials: "include",
          method: "POST",
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        success?: boolean;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Upload failed");
      }
      if (json.success) {
        await fetchProduct();
      }
      if (json.message && !json.success) {
        setError(json.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-host failed");
    } finally {
      setUploadMockupsLoading(false);
    }
  }, [id, fetchProduct]);

  const handleSlugFromName = useCallback(() => {
    if (name.trim()) setSlug(slugFromName(name));
  }, [name]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      const cents = Number.parseInt(priceCents, 10);
      if (Number.isNaN(cents) || cents < 0) {
        setError("Price must be a valid non-negative number.");
        return;
      }
      let weightGrams: null | number = null;
      if (weightValue.trim()) {
        const w = Number.parseFloat(weightValue);
        if (!Number.isNaN(w) && w >= 0) {
          weightGrams =
            weightUnit === "lb"
              ? Math.round(w * 453.592)
              : Math.round(w * 1000);
        }
      }
      setSaving(true);
      setError(null);
      try {
        const payload = {
          availableCountryCodes: availableCountryCodes.filter(
            (c) => !isShippingExcluded(c),
          ),
          barcode: barcode.trim() || null,
          brand: brand.trim() || null,
          categoryIds,
          compareAtPriceCents: compareAtPriceCents.trim()
            ? Number.parseInt(compareAtPriceCents, 10)
            : null,
          continueSellingWhenOutOfStock,
          costPerItemCents: costPerItemCents.trim()
            ? Number.parseInt(costPerItemCents, 10)
            : null,
          countryOfOrigin: countryOfOrigin.trim() || null,
          description: description.trim() || null,
          features: features.filter((f) => f.trim() !== ""),
          hasVariants,
          hidden,
          hsCode: hsCode.trim() || null,
          images: images
            .filter((i) => i.url.trim())
            .map((img, i) => ({
              alt: img.alt?.trim() || null,
              id: img.id,
              sortOrder: i,
              title: img.title?.trim() || null,
              url: img.url.trim(),
            })),
          imageUrl: imageUrl.trim() || null,
          mainCategoryId: mainCategoryId || (categoryIds[0] ?? null),
          mainImageAlt: mainImageAlt.trim() || null,
          mainImageTitle: mainImageTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          model: model.trim() || null,
          name: name.trim(),
          optionDefinitionsJson:
            hasVariants && optionDefinitions.length > 0
              ? JSON.stringify(
                  optionDefinitions.map(({ name, values }) => ({
                    name,
                    values: values.filter((v) => v.trim()),
                  })),
                )
              : null,
          pageTitle: pageTitle.trim() || null,
          physicalProduct,
          priceCents: cents,
          published,
          quantity: quantity.trim() ? Number.parseInt(quantity, 10) : null,
          seoOptimized,
          shipsFromCity: shipsFromCity.trim() || null,
          shipsFromCountry: shipsFromCountry.trim() || null,
          shipsFromDisplay: shipsFromDisplay.trim() || null,
          shipsFromPostalCode: shipsFromPostalCode.trim() || null,
          shipsFromRegion: shipsFromRegion.trim() || null,
          sku: sku.trim() || null,
          slug: slug.trim() || null,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          tokenGated,
          tokenGates: tokenGatesRef.current.map((g) => ({
            contractAddress: g.contractAddress?.trim() || null,
            id: g.id,
            network: g.network?.trim() || null,
            quantity:
              typeof g.quantity === "number"
                ? g.quantity
                : Number(g.quantity) || 0,
            tokenSymbol: (g.tokenSymbol ?? "").trim().toUpperCase(),
          })),
          trackQuantity,
          variants: hasVariants
            ? variants.map((v) => ({
                color: v.color ?? null,
                id: v.id,
                imageAlt: v.imageAlt ?? null,
                imageTitle: v.imageTitle ?? null,
                imageUrl: v.imageUrl ?? null,
                label: v.label ?? null,
                priceCents: v.priceCents,
                size: v.size ?? null,
                sku: v.sku ?? null,
                stockQuantity: v.stockQuantity ?? null,
              }))
            : undefined,
          vendor: vendor.trim() || null,
          weightGrams,
          weightUnit: weightUnit,
        };
        const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
          body: JSON.stringify(payload),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            detail?: string;
            error?: string;
            invalidCategoryIds?: string[];
          };
          const message = body.detail ?? body.error ?? "Failed to save";
          if (body.invalidCategoryIds?.length) {
            throw new Error(
              `${message} (invalid categories: ${body.invalidCategoryIds.join(", ")})`,
            );
          }
          throw new Error(message);
        }
        const saved = (await res.json()) as {
          printfulExportError?: string;
          printifyExportError?: string;
          tokenGates?: {
            contractAddress: null | string;
            id: string;
            network: null | string;
            quantity: number;
            tokenSymbol: string;
          }[];
        };
        if (Array.isArray(saved.tokenGates)) {
          if (
            saved.tokenGates.length > 0 ||
            tokenGatesRef.current.length === 0
          ) {
            setTokenGates(saved.tokenGates);
          }
          skipNextTokenGatesFromFetch.current = true;
        }
        if (saved.printfulExportError) {
          setError(
            `Product saved, but changes were not pushed to Printful: ${saved.printfulExportError}`,
          );
        } else if (saved.printifyExportError) {
          setError(
            `Product saved, but changes were not pushed to Printify: ${saved.printifyExportError}`,
          );
        } else {
          setError(null);
        }
        void fetchProduct();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      } finally {
        setSaving(false);
      }
    },
    [
      id,
      name,
      description,
      features,
      imageUrl,
      mainImageAlt,
      mainImageTitle,
      metaDescription,
      pageTitle,
      seoOptimized,
      priceCents,
      compareAtPriceCents,
      costPerItemCents,
      published,
      hidden,
      brand,
      model,
      vendor,
      slug,
      sku,
      barcode,
      weightValue,
      weightUnit,
      physicalProduct,
      trackQuantity,
      continueSellingWhenOutOfStock,
      quantity,
      hsCode,
      countryOfOrigin,
      shipsFromDisplay,
      shipsFromCountry,
      shipsFromRegion,
      shipsFromCity,
      shipsFromPostalCode,
      categoryIds,
      mainCategoryId,
      tagsInput,
      images,
      hasVariants,
      optionDefinitions,
      variants,
      tokenGated,
      availableCountryCodes,
      fetchProduct,
    ],
  );

  const addImage = useCallback(() => {
    setImages((prev) => [
      ...prev,
      { alt: "", sortOrder: prev.length, title: "", url: "" },
    ]);
  }, []);
  const updateImage = useCallback(
    (index: number, field: keyof ProductImage, value: string) => {
      setImages((prev) => {
        const next = [...prev];
        next[index] = { ...next[index]!, [field]: value };
        return next;
      });
    },
    [],
  );
  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item!);
      return next.map((img, i) => ({ ...img, sortOrder: i }));
    });
  }, []);

  const [primaryDropActive, setPrimaryDropActive] = useState(false);
  const [galleryDropActive, setGalleryDropActive] = useState(false);
  const [dragImageIndex, setDragImageIndex] = useState<null | number>(null);

  const uploadFilesToGallery = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadImageLoading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
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
        setImages((prev) => [
          ...prev,
          { alt: "", sortOrder: prev.length, title: "", url: data.url },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadImageLoading(false);
    }
  }, []);

  const uploadFileAsPrimary = useCallback(async (file: File) => {
    setUploadImageLoading(true);
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
      setUploadImageLoading(false);
    }
  }, []);

  const uploadImageInputRef = useRef<HTMLInputElement>(null);
  const uploadImageTargetRef = useRef<"primary" | null | number>(null);
  const [uploadImageLoading, setUploadImageLoading] = useState(false);
  const handleUploadImage = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const target = uploadImageTargetRef.current;
      uploadImageTargetRef.current = null;
      if (!file || target === null) return;
      setUploadImageLoading(true);
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
        if (target === "primary") setImageUrl(data.url);
        else if (typeof target === "number")
          updateImage(target, "url", data.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadImageLoading(false);
      }
    },
    [updateImage],
  );
  const triggerUploadImage = useCallback((target: "primary" | number) => {
    uploadImageTargetRef.current = target;
    uploadImageInputRef.current?.click();
  }, []);

  // Option definitions handlers
  const addOption = useCallback(() => {
    setOptionDefinitions((prev) => [
      ...prev,
      { isExpanded: true, name: "", values: [""] },
    ]);
  }, []);

  const updateOptionName = useCallback((index: number, name: string) => {
    setOptionDefinitions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, name };
      return next;
    });
  }, []);

  const addOptionValue = useCallback((optIndex: number, value = "") => {
    setOptionDefinitions((prev) => {
      const next = [...prev];
      next[optIndex] = {
        ...next[optIndex]!,
        values: [...next[optIndex]!.values, value],
      };
      return next;
    });
  }, []);

  const updateOptionValue = useCallback(
    (optIndex: number, valIndex: number, value: string) => {
      setOptionDefinitions((prev) => {
        const next = prev.map((o, i) =>
          i !== optIndex
            ? o
            : {
                ...o,
                values: o.values.map((v, j) => (j === valIndex ? value : v)),
              },
        );
        return next;
      });
    },
    [],
  );

  const removeOptionValue = useCallback(
    (optIndex: number, valIndex: number) => {
      setOptionDefinitions((prev) =>
        prev.map((o, i) =>
          i !== optIndex
            ? o
            : { ...o, values: o.values.filter((_, j) => j !== valIndex) },
        ),
      );
    },
    [],
  );

  const removeOption = useCallback((index: number) => {
    setOptionDefinitions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const [draggedOptionIndex, setDraggedOptionIndex] = useState<null | number>(
    null,
  );

  const reorderOptions = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setOptionDefinitions((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      if (!removed) return prev;
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const toggleOptionExpanded = useCallback((index: number) => {
    setOptionDefinitions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, isExpanded: !next[index]!.isExpanded };
      return next;
    });
  }, []);

  const markOptionDone = useCallback((index: number) => {
    setOptionDefinitions((prev) => {
      const next = [...prev];
      const cleanedValues = next[index]!.values.filter((v) => v.trim());
      next[index] = {
        ...next[index]!,
        isExpanded: false,
        values: cleanedValues.length > 0 ? cleanedValues : [""],
      };
      return next;
    });
  }, []);

  // Auto-regenerate variants when options change
  const basePriceCents = useMemo(() => {
    const cents = Number.parseInt(priceCents, 10);
    return Number.isFinite(cents) && cents > 0
      ? cents
      : (product?.priceCents ?? 0);
  }, [priceCents, product?.priceCents]);

  const regenerateVariants = useCallback(() => {
    if (!hasVariants) return;
    const newVariants = generateVariantsFromOptions(
      optionDefinitions,
      basePriceCents,
      variants,
    );
    setVariants(newVariants);
  }, [optionDefinitions, basePriceCents, hasVariants, variants]);

  // Variant handlers
  const updateVariant = useCallback(
    (
      index: number,
      field: keyof ProductVariant,
      value: number | string | undefined,
    ) => {
      setVariants((prev) => {
        const next = [...prev];
        next[index] = { ...next[index]!, [field]: value };
        return next;
      });
    },
    [],
  );

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

  if (error && !product) {
    return (
      <div className="space-y-4">
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/products"
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

  // Public storefront uses /{slug}; use form slug so View link stays correct after slug is updated
  const storefrontProductUrl = product
    ? `${API_BASE}/${slug?.trim() || product.slug?.trim() || product.id}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit Product</h2>
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/products"
        >
          ← Back to list
        </Link>
        {storefrontProductUrl ? (
          <a
            className={`
              text-sm font-medium text-primary
              hover:underline
            `}
            href={storefrontProductUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            View product ↗
          </a>
        ) : null}
        <Button
          className="ml-auto"
          disabled={saving}
          onClick={() => formRef.current?.requestSubmit()}
          type="button"
        >
          {saving ? "Saving…" : "Save product"}
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

      <form className="space-y-6" onSubmit={handleSubmit} ref={formRef}>
        {/* Basic */}
        <Card>
          <CardHeader>
            <CardTitle>Basic info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
                grid gap-4
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
                  placeholder="Product name"
                  required
                  type="text"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} id="categoryIds-label">
                  Categories
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Add multiple categories. One is used as the primary (for
                  URL/breadcrumbs).
                </p>
                {categoryIds.length > 0 && (
                  <ul className="mb-2 flex flex-wrap gap-2">
                    {categoryIds.map((cid) => {
                      const opt = categoryOptions.find((c) => c.id === cid);
                      const label = opt
                        ? opt.parentName?.trim()
                          ? `${opt.parentName.trim()} → ${opt.name}`
                          : opt.name
                        : cid;
                      const isPrimary = cid === mainCategoryId;
                      return (
                        <li
                          className={cn(
                            `
                              inline-flex items-center gap-1.5 rounded-md border
                              bg-muted/50 px-2.5 py-1.5 text-sm
                            `,
                            isPrimary &&
                              "border-primary/50 ring-1 ring-primary/30",
                          )}
                          key={cid}
                        >
                          {isPrimary && (
                            <span className="text-xs font-medium text-primary">
                              Primary
                            </span>
                          )}
                          <span className="max-w-[200px] truncate">
                            {label}
                          </span>
                          <button
                            aria-label={`Remove ${label}`}
                            className={`
                              shrink-0 rounded p-0.5 text-muted-foreground
                              hover:bg-muted hover:text-foreground
                            `}
                            onClick={() => {
                              setCategoryIds((prev) =>
                                prev.filter((id) => id !== cid),
                              );
                              if (mainCategoryId === cid) {
                                const rest = categoryIds.filter(
                                  (id) => id !== cid,
                                );
                                setMainCategoryId(rest[0] ?? "");
                              }
                            }}
                            title="Remove category"
                            type="button"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          {!isPrimary && (
                            <button
                              className={`
                                shrink-0 text-xs text-muted-foreground underline
                                hover:text-foreground
                              `}
                              onClick={() => setMainCategoryId(cid)}
                              type="button"
                            >
                              Set primary
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <CategorySelect
                  className={inputClass}
                  emptyLabel="Add a category…"
                  id="categoryIds-add"
                  labelClass={labelClass}
                  onChange={(id) => {
                    if (id && !categoryIds.includes(id)) {
                      setCategoryIds((prev) => [...prev, id]);
                      if (!mainCategoryId) setMainCategoryId(id);
                    }
                    setAddCategoryValue("");
                  }}
                  options={categoryOptions.filter(
                    (c) => !categoryIds.includes(c.id),
                  )}
                  placeholder="Search categories…"
                  value={addCategoryValue}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="features">
                Features
              </label>
              <textarea
                className={cn(inputClass, "resize-y")}
                id="features"
                onChange={(e) =>
                  setFeatures(
                    e.target.value.split("\n").map((line) => line.trimEnd()),
                  )
                }
                placeholder="One bullet point per line (e.g. Premium cotton, Machine washable)"
                rows={5}
                value={features.join("\n")}
              />
              <p className="text-xs text-muted-foreground">
                Shown as bullet points on the product page. Add one feature per
                line.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <label className={labelClass} htmlFor="description">
                Description
              </label>
              <textarea
                className={cn(inputClass, "mt-2 resize-y")}
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product description (HTML supported: e.g. <p>, <strong>, <a>)"
                rows={4}
                value={description}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Shown in the Description accordion on the storefront. Printify
                imports use HTML; it is sanitized before display.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
                grid gap-4
                sm:grid-cols-3
              `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="priceCents">
                  Price (USD)
                </label>
                <input
                  className={inputClass}
                  id="priceCents"
                  min={0}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setPriceCents("");
                    else {
                      const n = Number.parseFloat(v);
                      if (!Number.isNaN(n) && n >= 0)
                        setPriceCents(String(Math.round(n * 100)));
                    }
                  }}
                  required
                  step={0.01}
                  type="number"
                  value={priceCents === "" ? "" : Number(priceCents) / 100}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="compareAtPriceCents">
                  Compare at price (USD)
                </label>
                <input
                  className={inputClass}
                  id="compareAtPriceCents"
                  min={0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCompareAtPriceCents(
                      v === ""
                        ? ""
                        : String(Math.round(Number.parseFloat(v) * 100)),
                    );
                  }}
                  step={0.01}
                  type="number"
                  value={
                    compareAtPriceCents === ""
                      ? ""
                      : Number(compareAtPriceCents) / 100
                  }
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="costPerItemCents">
                  Cost per item (USD)
                </label>
                <input
                  className={inputClass}
                  id="costPerItemCents"
                  min={0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCostPerItemCents(
                      v === ""
                        ? ""
                        : String(Math.round(Number.parseFloat(v) * 100)),
                    );
                  }}
                  step={0.01}
                  type="number"
                  value={
                    costPerItemCents === ""
                      ? ""
                      : Number(costPerItemCents) / 100
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Customers won&apos;t see this.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
                grid gap-4
                sm:grid-cols-2
              `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="sku">
                  SKU
                </label>
                <input
                  className={inputClass}
                  id="sku"
                  onChange={(e) => setSku(e.target.value)}
                  type="text"
                  value={sku}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="barcode">
                  Barcode (ISBN, UPC, GTIN)
                </label>
                <input
                  className={inputClass}
                  id="barcode"
                  onChange={(e) => setBarcode(e.target.value)}
                  type="text"
                  value={barcode}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  checked={trackQuantity}
                  className="size-4 rounded border-input"
                  onChange={(e) => setTrackQuantity(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-sm">Track quantity</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={continueSellingWhenOutOfStock}
                  className="size-4 rounded border-input"
                  onChange={(e) =>
                    setContinueSellingWhenOutOfStock(e.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-sm">
                  Continue selling when out of stock
                </span>
              </label>
            </div>
            {trackQuantity && !hasVariants && (
              <div className="max-w-xs space-y-2">
                <label className={labelClass} htmlFor="quantity">
                  Quantity
                </label>
                <input
                  className={inputClass}
                  id="quantity"
                  min={0}
                  onChange={(e) => setQuantity(e.target.value)}
                  type="number"
                  value={quantity}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping & customs */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping & customs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                checked={physicalProduct}
                className="size-4 rounded border-input"
                onChange={(e) => setPhysicalProduct(e.target.checked)}
                type="checkbox"
              />
              <span className="text-sm">This is a physical product</span>
            </label>
            {physicalProduct && (
              <div className="flex items-end gap-2">
                <div className="max-w-[120px] flex-1 space-y-2">
                  <label className={labelClass} htmlFor="weightValue">
                    Weight
                  </label>
                  <input
                    className={inputClass}
                    id="weightValue"
                    min={0}
                    onChange={(e) => setWeightValue(e.target.value)}
                    step={0.01}
                    type="number"
                    value={weightValue}
                  />
                </div>
                <div className="w-20 space-y-2">
                  <label className={labelClass} htmlFor="weightUnit">
                    Unit
                  </label>
                  <select
                    className={inputClass}
                    id="weightUnit"
                    onChange={(e) =>
                      setWeightUnit(e.target.value as "kg" | "lb")
                    }
                    value={weightUnit}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
            )}
            <div
              className={`
                grid gap-4
                sm:grid-cols-2
              `}
            >
              <div className="space-y-2">
                <label className={labelClass} htmlFor="hsCode">
                  HS Code (international shipping)
                </label>
                <input
                  className={inputClass}
                  id="hsCode"
                  onChange={(e) => setHsCode(e.target.value)}
                  placeholder="e.g. 6110.20"
                  type="text"
                  value={hsCode}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="countryOfOrigin">
                  Country of origin
                </label>
                <select
                  className={inputClass}
                  id="countryOfOrigin"
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  value={countryOfOrigin}
                >
                  {COUNTRY_ORIGIN_OPTIONS.map((c) => (
                    <option key={c || "empty"} value={c}>
                      {c || "—"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Ships from</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Optional. Full address or city/region/postal/country. Shown on
                  product pages and used for shipping-time estimates.
                </p>
                <div
                  className={`
                    grid gap-3
                    sm:grid-cols-2
                  `}
                >
                  <div className="sm:col-span-2">
                    <label
                      className="mb-1 block text-xs font-medium"
                      htmlFor="shipsFromDisplay"
                    >
                      Full address (optional)
                    </label>
                    <input
                      className={inputClass}
                      id="shipsFromDisplay"
                      onChange={(e) => setShipsFromDisplay(e.target.value)}
                      placeholder="e.g. 123 Main St, Austin, TX 78701, United States"
                      type="text"
                      value={shipsFromDisplay}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium"
                      htmlFor="shipsFromCity"
                    >
                      City
                    </label>
                    <input
                      className={inputClass}
                      id="shipsFromCity"
                      onChange={(e) => setShipsFromCity(e.target.value)}
                      placeholder="Austin"
                      type="text"
                      value={shipsFromCity}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium"
                      htmlFor="shipsFromRegion"
                    >
                      State / Region
                    </label>
                    <input
                      className={inputClass}
                      id="shipsFromRegion"
                      onChange={(e) => setShipsFromRegion(e.target.value)}
                      placeholder="TX"
                      type="text"
                      value={shipsFromRegion}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium"
                      htmlFor="shipsFromPostalCode"
                    >
                      Postal code
                    </label>
                    <input
                      className={inputClass}
                      id="shipsFromPostalCode"
                      onChange={(e) => setShipsFromPostalCode(e.target.value)}
                      placeholder="78701"
                      type="text"
                      value={shipsFromPostalCode}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-xs font-medium"
                      htmlFor="shipsFromCountry"
                    >
                      Country
                    </label>
                    <input
                      className={inputClass}
                      id="shipsFromCountry"
                      onChange={(e) => setShipsFromCountry(e.target.value)}
                      placeholder="United States"
                      type="text"
                      value={shipsFromCountry}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <input
          accept="image/jpeg,image/png,image/webp,image/gif"
          aria-hidden
          className="hidden"
          onChange={handleUploadImage}
          ref={uploadImageInputRef}
          type="file"
        />
        <Card>
          <CardHeader>
            <CardTitle>Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Primary image and gallery. Drag and drop to upload (optimized for
              web) or paste a URL.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div
                className={cn(
                  "rounded-md transition-colors",
                  primaryDropActive && "ring-2 ring-primary ring-offset-2",
                )}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith("image/"))
                    uploadFileAsPrimary(file);
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label className={labelClass} htmlFor="imageUrl">
                    Primary image URL
                  </label>
                  <Button
                    className="gap-1"
                    disabled={uploadImageLoading}
                    onClick={() => triggerUploadImage("primary")}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4" />
                    {uploadImageLoading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
                <input
                  className={inputClass}
                  id="imageUrl"
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPrimaryImageLoadError(false);
                  }}
                  placeholder="https://… or drop image"
                  type="url"
                  value={imageUrl}
                />
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      className={`
                        relative flex size-24 shrink-0 items-center
                        justify-center overflow-hidden rounded-md border
                        bg-muted transition-opacity
                        hover:opacity-90
                        focus:ring-2 focus:ring-ring focus:outline-none
                      `}
                      onClick={() => setExpandedImageUrl(imageUrl)}
                      title="Click to expand"
                      type="button"
                    >
                      {primaryImageLoadError ? (
                        <span
                          className={`
                            flex flex-col items-center gap-0.5 p-1 text-center
                            text-[10px] text-destructive
                          `}
                        >
                          <ImageIcon className="size-5" />
                          Failed to load
                        </span>
                      ) : (
                        <img
                          alt=""
                          className="size-full object-cover"
                          onError={() => setPrimaryImageLoadError(true)}
                          referrerPolicy="no-referrer"
                          src={imageUrl}
                        />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Click to expand
                    </span>
                  </div>
                )}
              </div>
              <div
                className={`
                  mt-2 grid gap-2
                  sm:grid-cols-2
                `}
              >
                <div>
                  <label className={labelClass} htmlFor="mainImageAlt">
                    Main image alt text (SEO)
                  </label>
                  <input
                    className={inputClass}
                    id="mainImageAlt"
                    onChange={(e) => setMainImageAlt(e.target.value)}
                    placeholder="Alt text for main image"
                    type="text"
                    value={mainImageAlt}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="mainImageTitle">
                    Main image title (SEO)
                  </label>
                  <input
                    className={inputClass}
                    id="mainImageTitle"
                    onChange={(e) => setMainImageTitle(e.target.value)}
                    placeholder="Title for main image"
                    type="text"
                    value={mainImageTitle}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={labelClass}>
                  Additional images (with Image SEO: alt, title)
                </span>
                <Button
                  className="gap-1"
                  onClick={addImage}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" /> Add image
                </Button>
              </div>
              <div
                className={cn(
                  `
                    rounded-md border-2 border-dashed py-4 text-center text-sm
                    text-muted-foreground transition-colors
                  `,
                  galleryDropActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30",
                )}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGalleryDropActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragImageIndex === null) setGalleryDropActive(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGalleryDropActive(false);
                  if (dragImageIndex !== null) return;
                  uploadFilesToGallery(e.dataTransfer.files);
                }}
              >
                Drop images here to add (optimized for web)
              </div>
              {images.map((img, i) => (
                <div
                  className={cn(
                    "flex flex-wrap items-start gap-2 rounded border p-2",
                    dragImageIndex === i && "opacity-60",
                  )}
                  key={i}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const from = parseInt(
                      e.dataTransfer.getData("text/plain"),
                      10,
                    );
                    if (!Number.isNaN(from) && from !== i) moveImage(from, i);
                  }}
                >
                  <span
                    className={`
                      flex shrink-0 cursor-grab touch-none items-center pt-2
                      active:cursor-grabbing
                    `}
                    draggable
                    onDragEnd={() => setDragImageIndex(null)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(i));
                      e.dataTransfer.effectAllowed = "move";
                      setDragImageIndex(i);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </span>
                  {img.url ? (
                    <button
                      className={`
                        relative size-16 shrink-0 overflow-hidden rounded border
                        bg-muted transition-opacity
                        hover:opacity-90
                        focus:ring-2 focus:ring-ring focus:outline-none
                      `}
                      onClick={() => setExpandedImageUrl(img.url)}
                      title="Click to expand"
                      type="button"
                    >
                      {}
                      <img
                        alt={img.alt ?? ""}
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        src={img.url}
                      />
                    </button>
                  ) : (
                    <div
                      className={`
                        flex size-16 shrink-0 items-center justify-center
                        rounded border border-dashed bg-muted/50 text-xs
                        text-muted-foreground
                      `}
                      title="No image URL"
                    >
                      —
                    </div>
                  )}
                  <input
                    className={cn(inputClass, "min-w-[200px] flex-1")}
                    onChange={(e) => updateImage(i, "url", e.target.value)}
                    placeholder="Image URL"
                    type="url"
                    value={img.url}
                  />
                  <Button
                    className="shrink-0 gap-1"
                    disabled={uploadImageLoading}
                    onClick={() => triggerUploadImage(i)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                  <input
                    className={cn(inputClass, "min-w-[120px] flex-1")}
                    onChange={(e) => updateImage(i, "alt", e.target.value)}
                    placeholder="Alt text (SEO)"
                    type="text"
                    value={img.alt ?? ""}
                  />
                  <input
                    className={cn(inputClass, "min-w-[120px] flex-1")}
                    onChange={(e) => updateImage(i, "title", e.target.value)}
                    placeholder="Title (SEO)"
                    type="text"
                    value={img.title ?? ""}
                  />
                  <Button
                    aria-label="Remove image"
                    onClick={() => removeImage(i)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {(product?.source === "printful" ||
              product?.source === "printify") && (
              <div
                className={`
                  mt-4 flex flex-wrap items-center gap-2 border-t pt-4
                `}
              >
                <p className="text-sm text-muted-foreground">
                  Images from Printful/Printify are on their CDN. Re-host to
                  UploadThing for SEO (WebP, filenames, alt) and your own
                  hosting.
                </p>
                <Button
                  className="gap-1.5"
                  disabled={uploadMockupsLoading}
                  onClick={() => void handleUploadMockups()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <CloudUpload
                    className={cn(
                      "size-3.5",
                      uploadMockupsLoading && "animate-pulse",
                    )}
                  />
                  {uploadMockupsLoading
                    ? "Re-hosting…"
                    : "Re-host images to UploadThing"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
                grid gap-4
                sm:grid-cols-2
                lg:grid-cols-3
              `}
            >
              <div>
                <BrandSelect
                  id="brand"
                  inputClass={inputClass}
                  labelClass={labelClass}
                  onChange={setBrand}
                  value={brand}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="model">
                  Model
                </label>
                <input
                  className={inputClass}
                  id="model"
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. 3001, 582 — used for size chart lookup"
                  type="text"
                  value={model}
                />
                <p className="text-xs text-muted-foreground">
                  Blank product model; must match size chart (provider + brand +
                  model).
                </p>
              </div>
              <div className="space-y-2">
                <label className={labelClass} htmlFor="vendor">
                  Vendor
                </label>
                <input
                  className={inputClass}
                  id="vendor"
                  onChange={(e) => setVendor(e.target.value)}
                  type="text"
                  value={vendor}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="tagsInput">
                Tags (comma-separated; act as extra categories)
              </label>
              <input
                className={inputClass}
                id="tagsInput"
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, tag3"
                type="text"
                value={tagsInput}
              />
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <Card>
          <CardHeader>
            <CardTitle>Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                checked={hasVariants}
                className="size-4 rounded border-input"
                onChange={(e) => {
                  setHasVariants(e.target.checked);
                  if (e.target.checked && optionDefinitions.length === 0) {
                    setOptionDefinitions([
                      { isExpanded: true, name: "Size", values: [""] },
                    ]);
                  }
                }}
                type="checkbox"
              />
              <span className="text-sm">
                This product has options, like size or color
              </span>
            </label>

            {hasVariants && (
              <>
                {/* Option Definitions */}
                <div className="space-y-3">
                  {optionDefinitions.map((opt, oi) => (
                    <div
                      className={`
                        rounded-lg border bg-card
                        ${draggedOptionIndex === oi ? `opacity-60` : ""}
                      `}
                      key={oi}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const from = draggedOptionIndex;
                        if (from == null) return;
                        setDraggedOptionIndex(null);
                        reorderOptions(from, oi);
                      }}
                    >
                      {/* Collapsed view */}
                      {!opt.isExpanded ? (
                        <div className="flex items-center gap-3 p-3">
                          <div
                            className={`
                              cursor-grab touch-none
                              active:cursor-grabbing
                            `}
                            draggable
                            onDragEnd={() => setDraggedOptionIndex(null)}
                            onDragStart={(e) => {
                              setDraggedOptionIndex(oi);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", String(oi));
                            }}
                            title="Drag to reorder"
                          >
                            <GripVertical
                              className={`
                                h-4 w-4 shrink-0 text-muted-foreground
                              `}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {opt.name || "Unnamed option"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {opt.values
                                .filter((v) => v.trim())
                                .map((val, vi) => (
                                  <span
                                    className={`
                                      inline-flex items-center rounded-md
                                      bg-muted px-2 py-0.5 text-xs font-medium
                                    `}
                                    key={vi}
                                  >
                                    {val}
                                  </span>
                                ))}
                            </div>
                          </div>
                          <Button
                            onClick={() => toggleOptionExpanded(oi)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Edit
                          </Button>
                        </div>
                      ) : (
                        /* Expanded view */
                        <div className="space-y-3 p-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`
                                mt-2.5 shrink-0 cursor-grab touch-none
                                active:cursor-grabbing
                              `}
                              draggable
                              onDragEnd={() => setDraggedOptionIndex(null)}
                              onDragStart={(e) => {
                                setDraggedOptionIndex(oi);
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData(
                                  "text/plain",
                                  String(oi),
                                );
                              }}
                              title="Drag to reorder"
                            >
                              <GripVertical
                                className={`h-4 w-4 text-muted-foreground`}
                              />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <label
                                  className={`mb-1 block text-sm font-medium`}
                                >
                                  Option name
                                </label>
                                <div className="relative">
                                  <input
                                    className={inputClass}
                                    list={`option-names-edit-${oi}`}
                                    onChange={(e) =>
                                      updateOptionName(oi, e.target.value)
                                    }
                                    placeholder="Size"
                                    type="text"
                                    value={opt.name}
                                  />
                                  <datalist id={`option-names-edit-${oi}`}>
                                    {OPTION_NAME_SUGGESTIONS.filter(
                                      (s) =>
                                        !optionDefinitions.some(
                                          (o, i) => i !== oi && o.name === s,
                                        ),
                                    ).map((suggestion) => (
                                      <option
                                        key={suggestion}
                                        value={suggestion}
                                      />
                                    ))}
                                  </datalist>
                                </div>
                              </div>

                              <div>
                                <label
                                  className={`mb-1 block text-sm font-medium`}
                                >
                                  Option values
                                </label>
                                <div className="space-y-2">
                                  {opt.values.map((val, vi) => (
                                    <div
                                      className="flex items-center gap-2"
                                      key={vi}
                                    >
                                      <input
                                        className={cn(inputClass, "flex-1")}
                                        onChange={(e) =>
                                          updateOptionValue(
                                            oi,
                                            vi,
                                            e.target.value,
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            addOptionValue(oi);
                                          }
                                        }}
                                        placeholder={
                                          opt.name === "Size"
                                            ? "Medium"
                                            : opt.name === "Color"
                                              ? "Blue"
                                              : "Value"
                                        }
                                        type="text"
                                        value={val}
                                      />
                                      {opt.values.length > 1 && (
                                        <Button
                                          onClick={() =>
                                            removeOptionValue(oi, vi)
                                          }
                                          size="icon"
                                          type="button"
                                          variant="ghost"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div
                                className={`
                                  flex items-center justify-between pt-2
                                `}
                              >
                                <Button
                                  onClick={() => {
                                    markOptionDone(oi);
                                    regenerateVariants();
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                            <Button
                              onClick={() => {
                                removeOption(oi);
                                regenerateVariants();
                              }}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    className={`
                      flex items-center gap-2 text-sm font-medium text-primary
                      hover:underline
                    `}
                    onClick={addOption}
                    type="button"
                  >
                    <Plus className="h-4 w-4" /> Add another option
                  </button>
                </div>

                {/* Variants Table */}
                {variants.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-medium">Variants</h4>
                      <div
                        className={`
                          flex items-center gap-2 text-sm text-muted-foreground
                        `}
                      >
                        <span>Select</span>
                        <button
                          className={`
                            text-primary
                            hover:underline
                          `}
                          type="button"
                        >
                          All
                        </button>
                        <button
                          className={`
                            text-primary
                            hover:underline
                          `}
                          type="button"
                        >
                          None
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="w-10 p-2">
                              <input
                                className="size-4 rounded border-input"
                                type="checkbox"
                              />
                            </th>
                            <th className="p-2 text-left">Variant</th>
                            <th className="p-2 text-left">Variant ID</th>
                            <th className="p-2 text-left">Label</th>
                            <th className="p-2 text-left">Price</th>
                            <th className="p-2 text-left">Quantity</th>
                            <th className="p-2 text-left">SKU</th>
                            <th className="w-16 p-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, vi) => (
                            <tr
                              className={`
                                border-b
                                last:border-0
                              `}
                              key={vi}
                            >
                              <td className="p-2">
                                <input
                                  className="size-4 rounded border-input"
                                  type="checkbox"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`
                                      flex h-10 w-10 shrink-0 items-center
                                      justify-center overflow-hidden rounded
                                      border border-dashed bg-muted/30
                                    `}
                                  >
                                    {v.imageUrl ? (
                                      <button
                                        className={`
                                          flex h-full w-full items-center
                                          justify-center transition-opacity
                                          hover:opacity-90
                                          focus:ring-2 focus:ring-ring
                                          focus:outline-none focus:ring-inset
                                        `}
                                        onClick={() =>
                                          setExpandedImageUrl(
                                            v.imageUrl ?? null,
                                          )
                                        }
                                        title="Click to expand"
                                        type="button"
                                      >
                                        <img
                                          alt=""
                                          className={`
                                            h-full w-full rounded object-cover
                                          `}
                                          referrerPolicy="no-referrer"
                                          src={v.imageUrl}
                                        />
                                      </button>
                                    ) : (
                                      <ImageIcon
                                        className={`
                                          h-4 w-4 text-muted-foreground
                                        `}
                                      />
                                    )}
                                  </div>
                                  <span className="font-medium">
                                    {getVariantLabel(v, optionDefinitions)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2">
                                <div
                                  className={`
                                    min-w-[8rem] font-mono text-xs
                                    text-muted-foreground
                                  `}
                                  title="Internal ID and Printful/Printify variant ID (for sync and shipping)"
                                >
                                  {v.id ? (
                                    <span
                                      className="block truncate"
                                      title={v.id}
                                    >
                                      {v.id}
                                    </span>
                                  ) : (
                                    <span className="italic">—</span>
                                  )}
                                  {v.printfulSyncVariantId != null && (
                                    <span
                                      className={`
                                        mt-0.5 block text-muted-foreground
                                      `}
                                      title={`Sync variant ID (decimal: ${v.printfulSyncVariantId})`}
                                    >
                                      Printful: #
                                      {typeof v.printfulSyncVariantId ===
                                        "number" &&
                                      Number.isSafeInteger(
                                        v.printfulSyncVariantId,
                                      )
                                        ? v.printfulSyncVariantId.toString(16)
                                        : String(v.printfulSyncVariantId)}
                                    </span>
                                  )}
                                  {v.printifyVariantId != null &&
                                    !v.printfulSyncVariantId && (
                                      <span
                                        className={`
                                          mt-0.5 block text-muted-foreground
                                        `}
                                      >
                                        Printify: {v.printifyVariantId}
                                      </span>
                                    )}
                                  {v.externalId != null && (
                                    <span
                                      className={`
                                        mt-0.5 block text-muted-foreground
                                      `}
                                      title="Catalog ID (shipping)"
                                    >
                                      Catalog: {v.externalId}
                                    </span>
                                  )}
                                  {!v.id &&
                                    !v.printfulSyncVariantId &&
                                    !v.printifyVariantId &&
                                    !v.externalId && (
                                      <span className="italic">—</span>
                                    )}
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  className={cn(inputClass, "w-40")}
                                  onChange={(e) =>
                                    updateVariant(vi, "label", e.target.value)
                                  }
                                  placeholder="Label (e.g. from Printful)"
                                  title="Variant display name (e.g. Printful sync variant name)"
                                  type="text"
                                  value={v.label ?? ""}
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center">
                                  <span className="mr-1 text-muted-foreground">
                                    $
                                  </span>
                                  <input
                                    className={cn(inputClass, "w-24")}
                                    min={0}
                                    onChange={(e) => {
                                      const n = Number.parseFloat(
                                        e.target.value,
                                      );
                                      updateVariant(
                                        vi,
                                        "priceCents",
                                        Number.isNaN(n)
                                          ? 0
                                          : Math.round(n * 100),
                                      );
                                    }}
                                    step={0.01}
                                    type="number"
                                    value={(v.priceCents / 100).toFixed(2)}
                                  />
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  className={cn(inputClass, "w-20")}
                                  min={0}
                                  onChange={(e) => {
                                    const n = Number.parseInt(
                                      e.target.value,
                                      10,
                                    );
                                    updateVariant(
                                      vi,
                                      "stockQuantity",
                                      Number.isNaN(n) ? 0 : n,
                                    );
                                  }}
                                  type="number"
                                  value={v.stockQuantity ?? 0}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  className={cn(inputClass, "w-28")}
                                  onChange={(e) =>
                                    updateVariant(vi, "sku", e.target.value)
                                  }
                                  placeholder="SKU"
                                  type="text"
                                  value={v.sku ?? ""}
                                />
                              </td>
                              <td className="p-2">
                                <Button
                                  onClick={() => setEditingVariantIndex(vi)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  Edit
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {optionDefinitions.length > 0 &&
                  optionDefinitions.every(
                    (o) => !o.values.some((v) => v.trim()),
                  ) && (
                    <p className="text-sm text-muted-foreground">
                      Add option values and click &quot;Done&quot; to generate
                      variants.
                    </p>
                  )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Image expand modal */}
        {expandedImageUrl && (
          <div
            aria-label="Expanded image"
            aria-modal="true"
            className={`
              fixed inset-0 z-[100] flex items-center justify-center bg-black/80
              p-4
            `}
            onClick={() => setExpandedImageUrl(null)}
            role="dialog"
          >
            <button
              aria-label="Close"
              className={`
                absolute top-4 right-4 rounded-md bg-black/50 p-2 text-white
                transition
                hover:bg-black/70
                focus:ring-2 focus:ring-white focus:outline-none
              `}
              onClick={() => setExpandedImageUrl(null)}
              type="button"
            >
              <X className="h-6 w-6" />
            </button>
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {}
              <img
                alt="Expanded view"
                className={`
                  max-h-[90vh] max-w-full rounded object-contain shadow-2xl
                `}
                onClick={(e) => e.stopPropagation()}
                referrerPolicy="no-referrer"
                src={expandedImageUrl ?? undefined}
              />
            </div>
          </div>
        )}

        {/* Variant Edit Modal */}
        {editingVariantIndex !== null && variants[editingVariantIndex] && (
          <div
            className={`
              fixed inset-0 z-50 flex items-center justify-center bg-black/50
            `}
          >
            <div
              className={`
                w-full max-w-md rounded-lg bg-background p-6 shadow-lg
              `}
            >
              <h3 className="mb-4 text-lg font-semibold">
                Edit Variant:{" "}
                {getVariantLabel(
                  variants[editingVariantIndex]!,
                  optionDefinitions,
                )}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Price ($)</label>
                  <input
                    className={inputClass}
                    min={0}
                    onChange={(e) => {
                      const n = Number.parseFloat(e.target.value);
                      updateVariant(
                        editingVariantIndex,
                        "priceCents",
                        Number.isNaN(n) ? 0 : Math.round(n * 100),
                      );
                    }}
                    step={0.01}
                    type="number"
                    value={(
                      variants[editingVariantIndex]!.priceCents / 100
                    ).toFixed(2)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    className={inputClass}
                    min={0}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      updateVariant(
                        editingVariantIndex,
                        "stockQuantity",
                        Number.isNaN(n) ? 0 : n,
                      );
                    }}
                    type="number"
                    value={variants[editingVariantIndex]!.stockQuantity ?? 0}
                  />
                </div>
                <div>
                  <label className={labelClass}>Label</label>
                  <input
                    className={inputClass}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "label",
                        e.target.value,
                      )
                    }
                    placeholder="Variant display name (e.g. from Printful)"
                    type="text"
                    value={variants[editingVariantIndex]!.label ?? ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>SKU</label>
                  <input
                    className={inputClass}
                    onChange={(e) =>
                      updateVariant(editingVariantIndex, "sku", e.target.value)
                    }
                    type="text"
                    value={variants[editingVariantIndex]!.sku ?? ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image URL</label>
                  <input
                    className={inputClass}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageUrl",
                        e.target.value,
                      )
                    }
                    placeholder="https://..."
                    type="url"
                    value={variants[editingVariantIndex]!.imageUrl ?? ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image alt text (SEO)</label>
                  <input
                    className={inputClass}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageAlt",
                        e.target.value,
                      )
                    }
                    placeholder="Alt text for variant image"
                    type="text"
                    value={variants[editingVariantIndex]!.imageAlt ?? ""}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image title (SEO)</label>
                  <input
                    className={inputClass}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageTitle",
                        e.target.value,
                      )
                    }
                    placeholder="Title for variant image"
                    type="text"
                    value={variants[editingVariantIndex]!.imageTitle ?? ""}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  onClick={() => setEditingVariantIndex(null)}
                  type="button"
                  variant="outline"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Markets */}
        <Card>
          <CardHeader>
            <CardTitle>Markets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which countries this product is available in. Leave all
              unchecked for &quot;available everywhere&quot;. If you select at
              least one country, the product will only be shown and purchasable
              in those regions (storefront and checkout).
            </p>
            {(product?.source === "printful" ||
              product?.source === "printify") && (
              <div
                className={`
                  flex flex-wrap items-center gap-2 text-sm
                  text-muted-foreground
                `}
              >
                <p className="basis-full">
                  {product?.source === "printful" ? "Printful" : "Printify"}{" "}
                  products: shipping countries (Markets) are filled on import or
                  re-sync. If Markets is empty, re-sync to refresh shipping
                  destinations.
                </p>
                {product?.source === "printful" && (
                  <Button
                    className="gap-1.5"
                    disabled={printfulResyncLoading}
                    onClick={() => void handlePrintfulResync()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        printfulResyncLoading && "animate-spin",
                      )}
                    />
                    {printfulResyncLoading
                      ? "Re-syncing…"
                      : "Sync from Printful"}
                  </Button>
                )}
                {product?.source === "printify" && (
                  <>
                    <Button
                      className="gap-1.5"
                      disabled={printifyResyncLoading}
                      onClick={() => void handlePrintifyResync()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          printifyResyncLoading && "animate-spin",
                        )}
                      />
                      {printifyResyncLoading
                        ? "Re-syncing…"
                        : "Sync from Printify"}
                    </Button>
                    <Button
                      className="gap-1.5"
                      disabled={printifyConfirmPublishLoading}
                      onClick={() => void handlePrintifyConfirmPublish()}
                      size="sm"
                      title="Re-call Printify publish API to clear stuck 'Publishing' status"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          printifyConfirmPublishLoading && "animate-spin",
                        )}
                      />
                      {printifyConfirmPublishLoading
                        ? "Confirming…"
                        : "Confirm publish in Printify"}
                    </Button>
                    <Button
                      className={`
                        gap-1.5 text-destructive
                        hover:text-destructive
                      `}
                      disabled={printifyDeleteLoading}
                      onClick={() => void handleDeleteFromPrintify()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="size-3.5" />
                      {printifyDeleteLoading
                        ? "Deleting…"
                        : "Delete from Printify"}
                    </Button>
                    <Button
                      className="gap-1.5"
                      disabled={printifyRegisterWebhooksLoading}
                      onClick={() => void handlePrintifyRegisterWebhooks()}
                      size="sm"
                      title="Register product webhooks with Printify so Publishing can clear when we return 200"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCw
                        className={cn(
                          "size-3.5",
                          printifyRegisterWebhooksLoading && "animate-spin",
                        )}
                      />
                      {printifyRegisterWebhooksLoading
                        ? "Registering…"
                        : "Register webhooks"}
                    </Button>
                    <Button
                      className={`
                        gap-1.5 text-destructive
                        hover:text-destructive
                      `}
                      disabled={printifyDeleteAllWebhooksLoading}
                      onClick={() => void handlePrintifyDeleteAllWebhooks()}
                      size="sm"
                      title="Remove all webhooks for this shop (e.g. staging). Then register from production."
                      type="button"
                      variant="outline"
                    >
                      <Trash2
                        className={cn(
                          "size-3.5",
                          printifyDeleteAllWebhooksLoading && "animate-spin",
                        )}
                      />
                      {printifyDeleteAllWebhooksLoading
                        ? "Deleting…"
                        : "Delete all webhooks"}
                    </Button>
                  </>
                )}
              </div>
            )}
            {product?.source === "printify" && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Products going to staging? Use &quot;Delete all
                    webhooks&quot; above (from production), then &quot;Register
                    webhooks&quot; so only production URL is registered. Stuck
                    in Publishing? Sync and Confirm publish often do not change
                    status for already-stuck products (Printify may not re-send
                    the webhook). Reliable fix: 1) Click &quot;Register
                    webhooks&quot; above. 2) Delete this product in Printify (or
                    by ID below). 3) Re-create or re-publish the product in
                    Printify—the webhook will fire and status will become
                    Published. Or delete by Printify product ID:
                  </span>
                  <input
                    className={`
                      h-8 w-48 rounded border border-input bg-background px-2
                      text-sm
                    `}
                    onChange={(e) => setPrintifyIdToDelete(e.target.value)}
                    placeholder="Printify product ID"
                    type="text"
                    value={printifyIdToDelete}
                  />
                  <Button
                    className={`
                      gap-1.5 text-destructive
                      hover:text-destructive
                    `}
                    disabled={
                      printifyDeleteLoading || !printifyIdToDelete.trim()
                    }
                    onClick={() => void handleDeleteInPrintifyById()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="size-3.5" />
                    Delete in Printify
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Or import by Printify product ID (adds product to store):
                  </span>
                  <input
                    className={`
                      h-8 w-48 rounded border border-input bg-background px-2
                      text-sm
                    `}
                    onChange={(e) => setPrintifyIdToImport(e.target.value)}
                    placeholder="Printify product ID"
                    type="text"
                    value={printifyIdToImport}
                  />
                  <Button
                    className="gap-1.5"
                    disabled={
                      printifyImportLoading || !printifyIdToImport.trim()
                    }
                    onClick={() => void handleImportPrintifyById()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        printifyImportLoading && "animate-spin",
                      )}
                    />
                    {printifyImportLoading ? "Importing…" : "Import"}
                  </Button>
                </div>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              Countries we do not ship to are disabled and cannot be selected.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {COUNTRIES_BY_CONTINENT.map((entry, continentIndex) => (
              <div className="space-y-2" key={entry.continent}>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    checked={isContinentFullySelected(continentIndex)}
                    className="size-4 rounded border-input"
                    onChange={(e) =>
                      setContinent(continentIndex, e.target.checked)
                    }
                    ref={(el) => {
                      continentCheckboxRefs.current[continentIndex] = el;
                    }}
                    type="checkbox"
                  />
                  <span>{entry.continent}</span>
                </label>
                <div
                  className={`
                    grid grid-cols-2 gap-x-4 gap-y-1
                    sm:grid-cols-3
                    md:grid-cols-4
                  `}
                >
                  {entry.countries.map((country) => {
                    const noShip = isShippingExcluded(country.code);
                    return (
                      <label
                        className={cn(
                          `
                            flex items-center gap-2 text-sm
                            text-muted-foreground
                            hover:text-foreground
                          `,
                          noShip && "cursor-not-allowed opacity-60",
                        )}
                        key={country.code}
                      >
                        <input
                          checked={
                            !noShip && availableCountrySet.has(country.code)
                          }
                          className="size-4 rounded border-input"
                          disabled={noShip}
                          onChange={(e) =>
                            !noShip &&
                            setCountry(country.code, e.target.checked)
                          }
                          title={
                            noShip
                              ? "We do not ship to this country"
                              : undefined
                          }
                          type="checkbox"
                        />
                        <span>
                          {country.name}
                          {noShip ? " (no ship)" : ""}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Token gating */}
        <TokenGatesList
          description="Require user to hold ≥ quantity of ANY of these tokens to view this product."
          gates={tokenGates}
          inputClass={inputClass}
          labelClass={labelClass}
          onChange={setTokenGates}
          onTokenGatedChange={setTokenGated}
          title="Product token gates"
          tokenGated={tokenGated}
        />

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle>Search engine listing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="pageTitle">
                Page title
              </label>
              <input
                className={inputClass}
                id="pageTitle"
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Defaults to product name"
                type="text"
                value={pageTitle}
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="slug">
                Slug (URL)
              </label>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  id="slug"
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="url-slug"
                  type="text"
                  value={slug}
                />
                <Button
                  onClick={handleSlugFromName}
                  type="button"
                  variant="outline"
                >
                  From name
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Populated from product name if empty. Edit to customize.
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
                placeholder="Short summary for search results"
                rows={2}
                value={metaDescription}
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
              Product has been optimized for SEO / content / copy.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              checked={published}
              className="size-4 rounded border-input"
              onChange={(e) => setPublished(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium">
              Published (visible on storefront)
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              checked={hidden}
              className="size-4 rounded border-input"
              onChange={(e) => setHidden(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium">
              Hidden (only reachable by direct link; not listed in categories)
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button disabled={saving} type="submit">
            {saving ? "Saving…" : "Save product"}
          </Button>
          <Button
            onClick={() => router.push("/products")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Generate all variant combinations from option definitions */
function generateVariantsFromOptions(
  optionDefinitions: OptionDef[],
  basePriceCents: number,
  existingVariants: ProductVariant[] = [],
): ProductVariant[] {
  const validOptions = optionDefinitions.filter(
    (o) => o.name?.trim() && o.values.some((v) => v.trim()),
  );

  if (validOptions.length === 0) return [];

  // Build all combinations
  const combinations: Record<string, string>[] = [{}];

  for (const option of validOptions) {
    const cleanValues = option.values.filter((v) => v.trim());
    const newCombinations: Record<string, string>[] = [];

    for (const combo of combinations) {
      for (const value of cleanValues) {
        newCombinations.push({ ...combo, [option.name]: value.trim() });
      }
    }
    combinations.length = 0;
    combinations.push(...newCombinations);
  }

  // Create variants from combinations, preserving existing data where possible
  return combinations.map((combo) => {
    // Try to find existing variant with same options
    const existing = existingVariants.find((v) => {
      const vSize = v.size || v.optionValues?.Size || "";
      const vColor = v.color || v.optionValues?.Color || "";
      const comboSize = combo.Size || "";
      const comboColor = combo.Color || "";
      return vSize === comboSize && vColor === comboColor;
    });

    return {
      color: combo.Color || undefined,
      id: existing?.id,
      imageUrl: existing?.imageUrl || "",
      optionValues: combo,
      priceCents: existing?.priceCents ?? basePriceCents,
      size: combo.Size || undefined,
      sku: existing?.sku || "",
      stockQuantity: existing?.stockQuantity ?? 0,
    };
  });
}

/** Get variant display label from option values */
function getVariantLabel(
  variant: ProductVariant,
  optionDefinitions: OptionDef[],
): string {
  const parts: string[] = [];
  for (const opt of optionDefinitions) {
    const value =
      variant.optionValues?.[opt.name] ||
      (opt.name.toLowerCase() === "size" ? variant.size : undefined) ||
      (opt.name.toLowerCase() === "color" ? variant.color : undefined);
    if (value) parts.push(value);
  }
  return parts.join(" / ") || "Default";
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
