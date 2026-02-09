"use client";

import {
  ChevronDown,
  ChevronUp,
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

import { COUNTRIES_BY_CONTINENT } from "~/lib/countries-by-continent";
import { cn } from "~/lib/cn";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { BrandSelect } from "~/ui/brand-select";
import { CategorySelect } from "~/ui/category-select";
import type { TokenGateRow } from "~/ui/token-gates-list";
import { TokenGatesList } from "~/ui/token-gates-list";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

const COUNTRY_OPTIONS = [
  "",
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Australia",
  "Japan",
  "China",
  "Mexico",
  "India",
  "Brazil",
  "Netherlands",
  "South Korea",
  "Other",
];

// Common option names for the dropdown
const OPTION_NAME_SUGGESTIONS = ["Size", "Color", "Material", "Style"];

type ProductImage = {
  id?: string;
  url: string;
  alt?: string;
  title?: string;
  sortOrder?: number;
};
type ProductVariant = {
  id?: string;
  size?: string;
  color?: string;
  sku?: string;
  /** Display label (e.g. Printful variant name: "Product / Color / Size") */
  label?: string;
  stockQuantity?: number;
  priceCents: number;
  imageUrl?: string;
  imageAlt?: string;
  imageTitle?: string;
  availabilityStatus?: string | null;
  optionValues?: Record<string, string>;
};
type OptionDef = { name: string; values: string[]; isExpanded?: boolean };

type Product = {
  id: string;
  name: string;
  description: string | null;
  features?: string[];
  imageUrl: string | null;
  mainImageAlt?: string | null;
  mainImageTitle?: string | null;
  metaDescription: string | null;
  pageTitle: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costPerItemCents: number | null;
  published: boolean;
  brand: string | null;
  vendor: string | null;
  /** "manual" | "printful" | "printify" – used to show the correct sync button. */
  source?: string | null;
  slug: string | null;
  sku: string | null;
  barcode: string | null;
  weightGrams: number | null;
  weightUnit: string | null;
  physicalProduct: boolean;
  trackQuantity: boolean;
  continueSellingWhenOutOfStock: boolean;
  quantity: number | null;
  hsCode: string | null;
  countryOfOrigin: string | null;
  shipsFromDisplay: string | null;
  shipsFromCountry: string | null;
  shipsFromRegion: string | null;
  shipsFromCity: string | null;
  shipsFromPostalCode: string | null;
  hasVariants: boolean;
  optionDefinitionsJson: string | null;
  categoryId: string | null;
  tokenGated?: boolean;
  tokenGates?: TokenGateRow[];
  availableCountryCodes?: string[];
  images: ProductImage[];
  tags: string[];
  variants: ProductVariant[];
};

type CategoryOption = { id: string; name: string };

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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
      id: existing?.id,
      size: combo.Size || undefined,
      color: combo.Color || undefined,
      sku: existing?.sku || "",
      stockQuantity: existing?.stockQuantity ?? 0,
      priceCents: existing?.priceCents ?? basePriceCents,
      imageUrl: existing?.imageUrl || "",
      optionValues: combo,
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

export default function AdminProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [product, setProduct] = useState<Product | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [printfulResyncLoading, setPrintfulResyncLoading] = useState(false);
  const [printifyResyncLoading, setPrintifyResyncLoading] = useState(false);
  const [printifyConfirmPublishLoading, setPrintifyConfirmPublishLoading] =
    useState(false);
  const [printifyDeleteLoading, setPrintifyDeleteLoading] = useState(false);
  const [printifyIdToDelete, setPrintifyIdToDelete] = useState("");
  const [printifyIdToImport, setPrintifyIdToImport] = useState("");
  const [printifyImportLoading, setPrintifyImportLoading] = useState(false);
  const [uploadMockupsLoading, setUploadMockupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  /** Kept for backwards compatibility; description is no longer in an accordion. */
  const descriptionAccordionOpen = false;
  const [imageUrl, setImageUrl] = useState("");
  const [mainImageAlt, setMainImageAlt] = useState("");
  const [mainImageTitle, setMainImageTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [compareAtPriceCents, setCompareAtPriceCents] = useState("");
  const [costPerItemCents, setCostPerItemCents] = useState("");
  const [published, setPublished] = useState(true);
  const [brand, setBrand] = useState("");
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
  const [categoryId, setCategoryId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [optionDefinitions, setOptionDefinitions] = useState<OptionDef[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(
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
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
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
      const selectable = entry.countries.filter((c) => !isShippingExcluded(c.code));
      return selectable.length > 0 && selectable.every((c) => availableCountrySet.has(c.code));
    },
    [availableCountrySet],
  );
  const isContinentPartiallySelected = useCallback(
    (continentIndex: number) => {
      const entry = COUNTRIES_BY_CONTINENT[continentIndex];
      if (!entry) return false;
      const selectable = entry.countries.filter((c) => !isShippingExcluded(c.code));
      const count = selectable.filter((c) => availableCountrySet.has(c.code)).length;
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
  }, [availableCountrySet, isContinentPartiallySelected]);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
        credentials: "include",
        cache: "no-store",
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
        (data as { mainImageAlt?: string | null }).mainImageAlt ?? "",
      );
      setMainImageTitle(
        (data as { mainImageTitle?: string | null }).mainImageTitle ?? "",
      );
      setMetaDescription(data.metaDescription ?? "");
      setPageTitle(data.pageTitle ?? "");
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
      setBrand(data.brand ?? "");
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
      setCategoryId(data.categoryId ?? "");
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
        (data.availableCountryCodes ?? []).filter((c) => !isShippingExcluded(c)),
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "import_single",
          productId: product.id,
          overwrite: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "import_single",
          productId: product.id,
          overwrite: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "confirm_publish",
          productId: product.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "delete_in_printify",
          productId: product.id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Delete in Printify failed");
      }
      await fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete in Printify failed");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "delete_in_printify",
          printifyProductId: id,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Delete in Printify failed");
      }
      setPrintifyIdToDelete("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete in Printify failed");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "import_single",
          printifyProductId: id,
          overwrite: false,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        productId?: string;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Import failed");
      }
      setPrintifyIdToImport("");
      if (json.productId) {
        const base = window.location.pathname.replace(/[^/]+\/?$/, "").replace(/\/$/, "");
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
      const res = await fetch(`${API_BASE}/api/admin/products/${id}/upload-mockups`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
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
      let weightGrams: number | null = null;
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
          name: name.trim(),
          description: description.trim() || null,
          features: features.filter((f) => f.trim() !== ""),
          imageUrl: imageUrl.trim() || null,
          mainImageAlt: mainImageAlt.trim() || null,
          mainImageTitle: mainImageTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          pageTitle: pageTitle.trim() || null,
          priceCents: cents,
          compareAtPriceCents: compareAtPriceCents.trim()
            ? Number.parseInt(compareAtPriceCents, 10)
            : null,
          costPerItemCents: costPerItemCents.trim()
            ? Number.parseInt(costPerItemCents, 10)
            : null,
          published,
          brand: brand.trim() || null,
          vendor: vendor.trim() || null,
          slug: slug.trim() || null,
          sku: sku.trim() || null,
          barcode: barcode.trim() || null,
          weightGrams,
          weightUnit: weightUnit,
          physicalProduct,
          trackQuantity,
          continueSellingWhenOutOfStock,
          quantity: quantity.trim() ? Number.parseInt(quantity, 10) : null,
          hsCode: hsCode.trim() || null,
          countryOfOrigin: countryOfOrigin.trim() || null,
          categoryId: categoryId || null,
          hasVariants,
          optionDefinitionsJson:
            hasVariants && optionDefinitions.length > 0
              ? JSON.stringify(
                  optionDefinitions.map(({ name, values }) => ({
                    name,
                    values: values.filter((v) => v.trim()),
                  })),
                )
              : null,
          images: images
            .filter((i) => i.url.trim())
            .map((img, i) => ({
              id: img.id,
              url: img.url.trim(),
              alt: img.alt?.trim() || null,
              title: img.title?.trim() || null,
              sortOrder: i,
            })),
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          variants: hasVariants
            ? variants.map((v) => ({
                id: v.id,
                size: v.size ?? null,
                color: v.color ?? null,
                sku: v.sku ?? null,
                label: v.label ?? null,
                stockQuantity: v.stockQuantity ?? null,
                priceCents: v.priceCents,
                imageUrl: v.imageUrl ?? null,
                imageAlt: v.imageAlt ?? null,
                imageTitle: v.imageTitle ?? null,
              }))
            : undefined,
          tokenGated,
          tokenGates: tokenGatesRef.current.map((g) => ({
            id: g.id,
            tokenSymbol: (g.tokenSymbol ?? "").trim().toUpperCase(),
            quantity: typeof g.quantity === "number" ? g.quantity : Number(g.quantity) || 0,
            network: g.network?.trim() || null,
            contractAddress: g.contractAddress?.trim() || null,
          })),
          availableCountryCodes: availableCountryCodes.filter((c) => !isShippingExcluded(c)),
        };
        const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to save");
        }
        const saved = (await res.json()) as {
          tokenGates?: Array<{
            id: string;
            tokenSymbol: string;
            quantity: number;
            network: string | null;
            contractAddress: string | null;
          }>;
          printfulExportError?: string;
          printifyExportError?: string;
        };
        if (Array.isArray(saved.tokenGates)) {
          if (saved.tokenGates.length > 0 || tokenGatesRef.current.length === 0) {
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
      priceCents,
      compareAtPriceCents,
      costPerItemCents,
      published,
      brand,
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
      categoryId,
      tagsInput,
      images,
      hasVariants,
      optionDefinitions,
      variants,
      tokenGated,
      tokenGates,
      availableCountryCodes,
      fetchProduct,
    ],
  );

  const addImage = useCallback(() => {
    setImages((prev) => [
      ...prev,
      { url: "", alt: "", title: "", sortOrder: prev.length },
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
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null);

  const uploadFilesToGallery = useCallback(
    async (files: FileList | null) => {
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
            method: "POST",
            credentials: "include",
            body: form,
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error ?? "Upload failed");
          }
          const data = (await res.json()) as { url: string };
          setImages((prev) => [
            ...prev,
            { url: data.url, alt: "", title: "", sortOrder: prev.length },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadImageLoading(false);
      }
    },
    [],
  );

  const uploadFileAsPrimary = useCallback(async (file: File) => {
    setUploadImageLoading(true);
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
      setUploadImageLoading(false);
    }
  }, []);

  const uploadImageInputRef = useRef<HTMLInputElement>(null);
  const uploadImageTargetRef = useRef<null | "primary" | number>(null);
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
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
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
  const triggerUploadImage = useCallback(
    (target: "primary" | number) => {
      uploadImageTargetRef.current = target;
      uploadImageInputRef.current?.click();
    },
    [],
  );

  // Option definitions handlers
  const addOption = useCallback(() => {
    setOptionDefinitions((prev) => [
      ...prev,
      { name: "", values: [""], isExpanded: true },
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
        values: cleanedValues.length > 0 ? cleanedValues : [""],
        isExpanded: false,
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
      value: string | number | undefined,
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
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="space-y-4">
        <Link
          href="/products"
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

  // Public storefront uses /{slug}; use form slug so View link stays correct after slug is updated
  const storefrontProductUrl = product
    ? `${API_BASE}/${slug?.trim() || product.slug?.trim() || product.id}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit Product</h2>
        <Link
          href="/products"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to list
        </Link>
        {storefrontProductUrl ? (
          <a
            href={storefrontProductUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            View product ↗
          </a>
        ) : null}
        <Button
          type="button"
          disabled={saving}
          onClick={() => formRef.current?.requestSubmit()}
          className="ml-auto"
        >
          {saving ? "Saving…" : "Save product"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Basic */}
        <Card>
          <CardHeader>
            <CardTitle>Basic info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className={labelClass}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="Product name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <label id="categoryId-label" htmlFor="categoryId" className={labelClass}>
                  Category
                </label>
                <CategorySelect
                  id="categoryId"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categoryOptions}
                  className={inputClass}
                  labelClass={labelClass}
                  placeholder="Search categories…"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="features" className={labelClass}>
                Features
              </label>
              <textarea
                id="features"
                placeholder="One bullet point per line (e.g. Premium cotton, Machine washable)"
                value={features.join("\n")}
                onChange={(e) =>
                  setFeatures(
                    e.target.value.split("\n").map((line) => line.trimEnd()),
                  )
                }
                rows={5}
                className={cn(inputClass, "resize-y")}
              />
              <p className="text-xs text-muted-foreground">
                Shown as bullet points on the product page. Add one feature per
                line.
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                placeholder="Product description (HTML supported: e.g. <p>, <strong>, <a>)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className={cn(inputClass, "mt-2 resize-y")}
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="priceCents" className={labelClass}>
                  Price (USD)
                </label>
                <input
                  id="priceCents"
                  type="number"
                  min={0}
                  step={0.01}
                  value={priceCents === "" ? "" : Number(priceCents) / 100}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") setPriceCents("");
                    else {
                      const n = Number.parseFloat(v);
                      if (!Number.isNaN(n) && n >= 0)
                        setPriceCents(String(Math.round(n * 100)));
                    }
                  }}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="compareAtPriceCents" className={labelClass}>
                  Compare at price (USD)
                </label>
                <input
                  id="compareAtPriceCents"
                  type="number"
                  min={0}
                  step={0.01}
                  value={
                    compareAtPriceCents === ""
                      ? ""
                      : Number(compareAtPriceCents) / 100
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setCompareAtPriceCents(
                      v === ""
                        ? ""
                        : String(Math.round(Number.parseFloat(v) * 100)),
                    );
                  }}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="costPerItemCents" className={labelClass}>
                  Cost per item (USD)
                </label>
                <input
                  id="costPerItemCents"
                  type="number"
                  min={0}
                  step={0.01}
                  value={
                    costPerItemCents === ""
                      ? ""
                      : Number(costPerItemCents) / 100
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    setCostPerItemCents(
                      v === ""
                        ? ""
                        : String(Math.round(Number.parseFloat(v) * 100)),
                    );
                  }}
                  className={inputClass}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="sku" className={labelClass}>
                  SKU
                </label>
                <input
                  id="sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="barcode" className={labelClass}>
                  Barcode (ISBN, UPC, GTIN)
                </label>
                <input
                  id="barcode"
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={trackQuantity}
                  onChange={(e) => setTrackQuantity(e.target.checked)}
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">Track quantity</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={continueSellingWhenOutOfStock}
                  onChange={(e) =>
                    setContinueSellingWhenOutOfStock(e.target.checked)
                  }
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">
                  Continue selling when out of stock
                </span>
              </label>
            </div>
            {trackQuantity && !hasVariants && (
              <div className="space-y-2 max-w-xs">
                <label htmlFor="quantity" className={labelClass}>
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputClass}
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
                type="checkbox"
                checked={physicalProduct}
                onChange={(e) => setPhysicalProduct(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="text-sm">This is a physical product</span>
            </label>
            {physicalProduct && (
              <div className="flex gap-2 items-end">
                <div className="space-y-2 flex-1 max-w-[120px]">
                  <label htmlFor="weightValue" className={labelClass}>
                    Weight
                  </label>
                  <input
                    id="weightValue"
                    type="number"
                    min={0}
                    step={0.01}
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2 w-20">
                  <label htmlFor="weightUnit" className={labelClass}>
                    Unit
                  </label>
                  <select
                    id="weightUnit"
                    value={weightUnit}
                    onChange={(e) =>
                      setWeightUnit(e.target.value as "kg" | "lb")
                    }
                    className={inputClass}
                  >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                  </select>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="hsCode" className={labelClass}>
                  HS Code (international shipping)
                </label>
                <input
                  id="hsCode"
                  type="text"
                  value={hsCode}
                  onChange={(e) => setHsCode(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 6110.20"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="countryOfOrigin" className={labelClass}>
                  Country of origin
                </label>
                <select
                  id="countryOfOrigin"
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  className={inputClass}
                >
                  {COUNTRY_OPTIONS.map((c) => (
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="shipsFromDisplay"
                      className="mb-1 block text-xs font-medium"
                    >
                      Full address (optional)
                    </label>
                    <input
                      id="shipsFromDisplay"
                      type="text"
                      placeholder="e.g. 123 Main St, Austin, TX 78701, United States"
                      value={shipsFromDisplay}
                      onChange={(e) => setShipsFromDisplay(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipsFromCity"
                      className="mb-1 block text-xs font-medium"
                    >
                      City
                    </label>
                    <input
                      id="shipsFromCity"
                      type="text"
                      placeholder="Austin"
                      value={shipsFromCity}
                      onChange={(e) => setShipsFromCity(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipsFromRegion"
                      className="mb-1 block text-xs font-medium"
                    >
                      State / Region
                    </label>
                    <input
                      id="shipsFromRegion"
                      type="text"
                      placeholder="TX"
                      value={shipsFromRegion}
                      onChange={(e) => setShipsFromRegion(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipsFromPostalCode"
                      className="mb-1 block text-xs font-medium"
                    >
                      Postal code
                    </label>
                    <input
                      id="shipsFromPostalCode"
                      type="text"
                      placeholder="78701"
                      value={shipsFromPostalCode}
                      onChange={(e) => setShipsFromPostalCode(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipsFromCountry"
                      className="mb-1 block text-xs font-medium"
                    >
                      Country
                    </label>
                    <input
                      id="shipsFromCountry"
                      type="text"
                      placeholder="United States"
                      value={shipsFromCountry}
                      onChange={(e) => setShipsFromCountry(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <input
          ref={uploadImageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          aria-hidden
          onChange={handleUploadImage}
        />
        <Card>
          <CardHeader>
            <CardTitle>Media</CardTitle>
            <p className="text-sm text-muted-foreground">
              Primary image and gallery. Drag and drop to upload (optimized for web) or paste a URL.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrimaryDropActive(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith("image/")) uploadFileAsPrimary(file);
                }}
                className={cn(
                  "rounded-md transition-colors",
                  primaryDropActive && "ring-2 ring-primary ring-offset-2",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="imageUrl" className={labelClass}>
                    Primary image URL
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={uploadImageLoading}
                    onClick={() => triggerUploadImage("primary")}
                  >
                    <Upload className="h-4 w-4" />
                    {uploadImageLoading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
                <input
                  id="imageUrl"
                  type="url"
                  placeholder="https://… or drop image"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPrimaryImageLoadError(false);
                  }}
                  className={inputClass}
                />
                {imageUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedImageUrl(imageUrl)}
                      className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                      title="Click to expand"
                    >
                      {primaryImageLoadError ? (
                        <span className="flex flex-col items-center gap-0.5 p-1 text-center text-[10px] text-destructive">
                          <ImageIcon className="size-5" />
                          Failed to load
                        </span>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={imageUrl}
                          alt=""
                          className="size-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={() => setPrimaryImageLoadError(true)}
                        />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      Click to expand
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="mainImageAlt"
                    className={labelClass}
                  >
                    Main image alt text (SEO)
                  </label>
                  <input
                    id="mainImageAlt"
                    type="text"
                    placeholder="Alt text for main image"
                    value={mainImageAlt}
                    onChange={(e) => setMainImageAlt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="mainImageTitle"
                    className={labelClass}
                  >
                    Main image title (SEO)
                  </label>
                  <input
                    id="mainImageTitle"
                    type="text"
                    placeholder="Title for main image"
                    value={mainImageTitle}
                    onChange={(e) => setMainImageTitle(e.target.value)}
                    className={inputClass}
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
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addImage}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" /> Add image
                </Button>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragImageIndex === null) setGalleryDropActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGalleryDropActive(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setGalleryDropActive(false);
                  if (dragImageIndex !== null) return;
                  uploadFilesToGallery(e.dataTransfer.files);
                }}
                className={cn(
                  "rounded-md border-2 border-dashed py-4 text-center text-sm text-muted-foreground transition-colors",
                  galleryDropActive
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30",
                )}
              >
                Drop images here to add (optimized for web)
              </div>
              {images.map((img, i) => (
                <div
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
                    if (!Number.isNaN(from) && from !== i)
                      moveImage(from, i);
                  }}
                  className={cn(
                    "flex flex-wrap items-start gap-2 rounded border p-2",
                    dragImageIndex === i && "opacity-60",
                  )}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(i));
                      e.dataTransfer.effectAllowed = "move";
                      setDragImageIndex(i);
                    }}
                    onDragEnd={() => setDragImageIndex(null)}
                    className="flex shrink-0 cursor-grab touch-none items-center pt-2 active:cursor-grabbing"
                    title="Drag to reorder"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                      }
                    }}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <input
                    type="url"
                    placeholder="Image URL"
                    value={img.url}
                    onChange={(e) => updateImage(i, "url", e.target.value)}
                    className={cn(inputClass, "flex-1 min-w-[200px]")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    disabled={uploadImageLoading}
                    onClick={() => triggerUploadImage(i)}
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                  <input
                    type="text"
                    placeholder="Alt text (SEO)"
                    value={img.alt ?? ""}
                    onChange={(e) => updateImage(i, "alt", e.target.value)}
                    className={cn(inputClass, "flex-1 min-w-[120px]")}
                  />
                  <input
                    type="text"
                    placeholder="Title (SEO)"
                    value={img.title ?? ""}
                    onChange={(e) => updateImage(i, "title", e.target.value)}
                    className={cn(inputClass, "flex-1 min-w-[120px]")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImage(i)}
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {(product?.source === "printful" || product?.source === "printify") && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Images from Printful/Printify are on their CDN. Re-host to UploadThing for SEO (WebP, filenames, alt) and your own hosting.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadMockupsLoading}
                  onClick={() => void handleUploadMockups()}
                  className="gap-1.5"
                >
                  <CloudUpload
                    className={cn("size-3.5", uploadMockupsLoading && "animate-pulse")}
                  />
                  {uploadMockupsLoading ? "Re-hosting…" : "Re-host images to UploadThing"}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <BrandSelect
                  id="brand"
                  value={brand}
                  onChange={setBrand}
                  labelClass={labelClass}
                  inputClass={inputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="vendor" className={labelClass}>
                  Vendor
                </label>
                <input
                  id="vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="tagsInput" className={labelClass}>
                Tags (comma-separated; act as extra categories)
              </label>
              <input
                id="tagsInput"
                type="text"
                placeholder="tag1, tag2, tag3"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className={inputClass}
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
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => {
                  setHasVariants(e.target.checked);
                  if (e.target.checked && optionDefinitions.length === 0) {
                    setOptionDefinitions([
                      { name: "Size", values: [""], isExpanded: true },
                    ]);
                  }
                }}
                className="size-4 rounded border-input"
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
                    <div key={oi} className="rounded-lg border bg-card">
                      {/* Collapsed view */}
                      {!opt.isExpanded ? (
                        <div className="flex items-center gap-3 p-3">
                          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {opt.name || "Unnamed option"}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {opt.values
                                .filter((v) => v.trim())
                                .map((val, vi) => (
                                  <span
                                    key={vi}
                                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium"
                                  >
                                    {val}
                                  </span>
                                ))}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleOptionExpanded(oi)}
                          >
                            Edit
                          </Button>
                        </div>
                      ) : (
                        /* Expanded view */
                        <div className="space-y-3 p-3">
                          <div className="flex items-start gap-3">
                            <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="flex-1 space-y-3">
                              <div>
                                <label className="mb-1 block text-sm font-medium">
                                  Option name
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Size"
                                    value={opt.name}
                                    onChange={(e) =>
                                      updateOptionName(oi, e.target.value)
                                    }
                                    list={`option-names-edit-${oi}`}
                                    className={inputClass}
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
                                <label className="mb-1 block text-sm font-medium">
                                  Option values
                                </label>
                                <div className="space-y-2">
                                  {opt.values.map((val, vi) => (
                                    <div
                                      key={vi}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="text"
                                        placeholder={
                                          opt.name === "Size"
                                            ? "Medium"
                                            : opt.name === "Color"
                                              ? "Blue"
                                              : "Value"
                                        }
                                        value={val}
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
                                        className={cn(inputClass, "flex-1")}
                                      />
                                      {opt.values.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            removeOptionValue(oi, vi)
                                          }
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    markOptionDone(oi);
                                    regenerateVariants();
                                  }}
                                >
                                  Done
                                </Button>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                removeOption(oi);
                                regenerateVariants();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addOption}
                    className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    <Plus className="h-4 w-4" /> Add another option
                  </button>
                </div>

                {/* Variants Table */}
                {variants.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-medium">Variants</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Select</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className="text-primary hover:underline"
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
                                type="checkbox"
                                className="size-4 rounded border-input"
                              />
                            </th>
                            <th className="p-2 text-left">Variant</th>
                            <th className="p-2 text-left">Label</th>
                            <th className="p-2 text-left">Price</th>
                            <th className="p-2 text-left">Quantity</th>
                            <th className="p-2 text-left">SKU</th>
                            <th className="w-16 p-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, vi) => (
                            <tr key={vi} className="border-b last:border-0">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-input"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-dashed bg-muted/30">
                                    {v.imageUrl ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedImageUrl(v.imageUrl ?? null)
                                        }
                                        className="flex h-full w-full items-center justify-center transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
                                        title="Click to expand"
                                      >
                                        <img
                                          src={v.imageUrl}
                                          alt=""
                                          className="h-full w-full rounded object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      </button>
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span className="font-medium">
                                    {getVariantLabel(v, optionDefinitions)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="Label (e.g. from Printful)"
                                  value={v.label ?? ""}
                                  onChange={(e) =>
                                    updateVariant(vi, "label", e.target.value)
                                  }
                                  className={cn(inputClass, "w-40")}
                                  title="Variant display name (e.g. Printful sync variant name)"
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex items-center">
                                  <span className="mr-1 text-muted-foreground">
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={(v.priceCents / 100).toFixed(2)}
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
                                    className={cn(inputClass, "w-24")}
                                  />
                                </div>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={v.stockQuantity ?? 0}
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
                                  className={cn(inputClass, "w-20")}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder="SKU"
                                  value={v.sku ?? ""}
                                  onChange={(e) =>
                                    updateVariant(vi, "sku", e.target.value)
                                  }
                                  className={cn(inputClass, "w-28")}
                                />
                              </td>
                              <td className="p-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingVariantIndex(vi)}
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setExpandedImageUrl(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Expanded image"
          >
            <button
              type="button"
              onClick={() => setExpandedImageUrl(null)}
              className="absolute right-4 top-4 rounded-md bg-black/50 p-2 text-white transition hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
            <div
              className="relative max-h-[90vh] max-w-[90vw]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expandedImageUrl ?? undefined}
                alt="Expanded view"
                className="max-h-[90vh] max-w-full rounded object-contain shadow-2xl"
                referrerPolicy="no-referrer"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Variant Edit Modal */}
        {editingVariantIndex !== null && variants[editingVariantIndex] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
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
                    type="number"
                    min={0}
                    step={0.01}
                    value={(
                      variants[editingVariantIndex]!.priceCents / 100
                    ).toFixed(2)}
                    onChange={(e) => {
                      const n = Number.parseFloat(e.target.value);
                      updateVariant(
                        editingVariantIndex,
                        "priceCents",
                        Number.isNaN(n) ? 0 : Math.round(n * 100),
                      );
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={variants[editingVariantIndex]!.stockQuantity ?? 0}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      updateVariant(
                        editingVariantIndex,
                        "stockQuantity",
                        Number.isNaN(n) ? 0 : n,
                      );
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Label</label>
                  <input
                    type="text"
                    placeholder="Variant display name (e.g. from Printful)"
                    value={variants[editingVariantIndex]!.label ?? ""}
                    onChange={(e) =>
                      updateVariant(editingVariantIndex, "label", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>SKU</label>
                  <input
                    type="text"
                    value={variants[editingVariantIndex]!.sku ?? ""}
                    onChange={(e) =>
                      updateVariant(editingVariantIndex, "sku", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={variants[editingVariantIndex]!.imageUrl ?? ""}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageUrl",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image alt text (SEO)</label>
                  <input
                    type="text"
                    placeholder="Alt text for variant image"
                    value={variants[editingVariantIndex]!.imageAlt ?? ""}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageAlt",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Image title (SEO)</label>
                  <input
                    type="text"
                    placeholder="Title for variant image"
                    value={variants[editingVariantIndex]!.imageTitle ?? ""}
                    onChange={(e) =>
                      updateVariant(
                        editingVariantIndex,
                        "imageTitle",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingVariantIndex(null)}
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
            {(product?.source === "printful" || product?.source === "printify") && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <p className="basis-full">
                  {product?.source === "printful"
                    ? "Printful"
                    : "Printify"}{" "}
                  products: shipping countries (Markets) are filled on import or
                  re-sync. If Markets is empty, re-sync to refresh shipping
                  destinations.
                </p>
                {product?.source === "printful" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={printfulResyncLoading}
                    onClick={() => void handlePrintfulResync()}
                    className="gap-1.5"
                  >
                    <RefreshCw
                      className={cn("size-3.5", printfulResyncLoading && "animate-spin")}
                    />
                    {printfulResyncLoading ? "Re-syncing…" : "Sync from Printful"}
                  </Button>
                )}
                {product?.source === "printify" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={printifyResyncLoading}
                      onClick={() => void handlePrintifyResync()}
                      className="gap-1.5"
                    >
                      <RefreshCw
                        className={cn("size-3.5", printifyResyncLoading && "animate-spin")}
                      />
                      {printifyResyncLoading ? "Re-syncing…" : "Sync from Printify"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={printifyConfirmPublishLoading}
                      onClick={() => void handlePrintifyConfirmPublish()}
                      className="gap-1.5"
                      title="Re-call Printify publish API to clear stuck 'Publishing' status"
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
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={printifyDeleteLoading}
                      onClick={() => void handleDeleteFromPrintify()}
                      className="gap-1.5 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      {printifyDeleteLoading ? "Deleting…" : "Delete from Printify"}
                    </Button>
                  </>
                )}
              </div>
            )}
            {product?.source === "printify" && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Stuck in Publishing? Use &quot;Confirm publish in Printify&quot; above first (or for all: POST /api/admin/printify/sync with {`{ "action": "confirm_publish" }`}). Or delete by Printify product ID:
                  </span>
                  <input
                    type="text"
                    placeholder="Printify product ID"
                    value={printifyIdToDelete}
                    onChange={(e) => setPrintifyIdToDelete(e.target.value)}
                    className="h-8 w-48 rounded border border-input bg-background px-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={printifyDeleteLoading || !printifyIdToDelete.trim()}
                    onClick={() => void handleDeleteInPrintifyById()}
                    className="gap-1.5 text-destructive hover:text-destructive"
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
                    type="text"
                    placeholder="Printify product ID"
                    value={printifyIdToImport}
                    onChange={(e) => setPrintifyIdToImport(e.target.value)}
                    className="h-8 w-48 rounded border border-input bg-background px-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={printifyImportLoading || !printifyIdToImport.trim()}
                    onClick={() => void handleImportPrintifyById()}
                    className="gap-1.5"
                  >
                    <RefreshCw className={cn("size-3.5", printifyImportLoading && "animate-spin")} />
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
              <div key={entry.continent} className="space-y-2">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isContinentFullySelected(continentIndex)}
                    ref={(el) => {
                      continentCheckboxRefs.current[continentIndex] = el;
                    }}
                    onChange={(e) =>
                      setContinent(continentIndex, e.target.checked)
                    }
                    className="size-4 rounded border-input"
                  />
                  <span>{entry.continent}</span>
                </label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 md:grid-cols-4">
                  {entry.countries.map((country) => {
                    const noShip = isShippingExcluded(country.code);
                    return (
                      <label
                        key={country.code}
                        className={cn(
                          "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
                          noShip && "cursor-not-allowed opacity-60",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!noShip && availableCountrySet.has(country.code)}
                          disabled={noShip}
                          onChange={(e) =>
                            !noShip && setCountry(country.code, e.target.checked)
                          }
                          className="size-4 rounded border-input"
                          title={noShip ? "We do not ship to this country" : undefined}
                        />
                        <span>{country.name}{noShip ? " (no ship)" : ""}</span>
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
          gates={tokenGates}
          onChange={setTokenGates}
          tokenGated={tokenGated}
          onTokenGatedChange={setTokenGated}
          title="Product token gates"
          description="Require user to hold ≥ quantity of ANY of these tokens to view this product."
          inputClass={inputClass}
          labelClass={labelClass}
        />

        {/* SEO */}
        <Card>
          <CardHeader>
            <CardTitle>Search engine listing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="pageTitle" className={labelClass}>
                Page title
              </label>
              <input
                id="pageTitle"
                type="text"
                placeholder="Defaults to product name"
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="slug" className={labelClass}>
                Slug (URL)
              </label>
              <div className="flex gap-2">
                <input
                  id="slug"
                  type="text"
                  placeholder="url-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className={inputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSlugFromName}
                >
                  From name
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Populated from product name if empty. Edit to customize.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="metaDescription" className={labelClass}>
                Meta description
              </label>
              <textarea
                id="metaDescription"
                placeholder="Short summary for search results"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                className={cn(inputClass, "resize-y")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span className="text-sm font-medium">
              Published (visible on storefront)
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save product"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/products")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
