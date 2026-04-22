"use client";

import { GripVertical, ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
interface ProductImage {
  alt?: string;
  id?: string;
  sortOrder?: number;
  title?: string;
  url: string;
}
interface ProductVariant {
  color?: string;
  id?: string;
  imageUrl?: string;
  // For multi-option support, store all option values
  optionValues?: Record<string, string>;
  priceCents: number;
  size?: string;
  sku?: string;
  stockQuantity?: number;
}

export default function AdminProductsCreatePage() {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [seoOptimized, setSeoOptimized] = useState(false);
  const [priceCents, setPriceCents] = useState("");
  const [compareAtPriceCents, setCompareAtPriceCents] = useState("");
  const [costPerItemCents, setCostPerItemCents] = useState("");
  const [published, setPublished] = useState(true);
  const [hidden, setHidden] = useState(false);
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
  const [editingVariantIndex, setEditingVariantIndex] = useState<null | number>(
    null,
  );
  const [tokenGated, setTokenGated] = useState(false);
  const [tokenGates, setTokenGates] = useState<TokenGateRow[]>([]);
  const [availableCountryCodes, setAvailableCountryCodes] = useState<string[]>(
    [],
  );
  const [expandedImageUrl, setExpandedImageUrl] = useState<null | string>(null);

  const availableCountrySet = useMemo(
    () => new Set(availableCountryCodes),
    [availableCountryCodes],
  );
  const setCountry = useCallback((code: string, checked: boolean) => {
    if (isShippingExcluded(code)) return;
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
  const continentCheckboxRefs = useRef<Record<number, HTMLInputElement | null>>(
    {},
  );
  useEffect(() => {
    COUNTRIES_BY_CONTINENT.forEach((_, i) => {
      const el = continentCheckboxRefs.current[i];
      if (el) el.indeterminate = isContinentPartiallySelected(i);
    });
  }, [isContinentPartiallySelected]);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const handleSlugFromName = useCallback(() => {
    if (name.trim()) setSlug(slugFromName(name));
  }, [name]);

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
      // Clean up empty values
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
    return Number.isFinite(cents) && cents > 0 ? cents : 0;
  }, [priceCents]);

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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
          availableCountryCodes:
            availableCountryCodes.length > 0
              ? availableCountryCodes.filter((c) => !isShippingExcluded(c))
              : undefined,
          barcode: barcode.trim() || null,
          brand: brand.trim() || null,
          categoryId: categoryId || null,
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
          metaDescription: metaDescription.trim() || null,
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
          tokenGates,
          trackQuantity,
          variants: hasVariants
            ? variants.map((v) => ({
                color: v.color ?? null,
                id: v.id,
                imageUrl: v.imageUrl ?? null,
                priceCents: v.priceCents,
                size: v.size ?? null,
                sku: v.sku ?? null,
                stockQuantity: v.stockQuantity ?? null,
              }))
            : undefined,
          vendor: vendor.trim() || null,
          weightGrams,
          weightUnit,
        };
        const res = await fetch(`${API_BASE}/api/admin/products`, {
          body: JSON.stringify(payload),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to create product");
        }
        const data = (await res.json()) as { id: string };
        router.push(`/products/${data.id}/edit`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create product",
        );
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      description,
      features,
      imageUrl,
      metaDescription,
      pageTitle,
      seoOptimized,
      priceCents,
      compareAtPriceCents,
      costPerItemCents,
      published,
      hidden,
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
      categoryId,
      tagsInput,
      images,
      hasVariants,
      optionDefinitions,
      variants,
      tokenGated,
      tokenGates,
      availableCountryCodes,
      router,
      shipsFromRegion.trim,
      shipsFromPostalCode.trim,
      shipsFromDisplay.trim,
      shipsFromCountry.trim,
      shipsFromCity.trim,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Create Product
        </h2>
        <Link
          className={`
            text-sm font-medium text-muted-foreground
            hover:text-foreground
          `}
          href="/products"
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

      <form className="space-y-6" onSubmit={handleSubmit}>
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
                <label
                  className={labelClass}
                  htmlFor="categoryId"
                  id="categoryId-label"
                >
                  Category
                </label>
                <CategorySelect
                  className={inputClass}
                  disabled={loading}
                  id="categoryId"
                  labelClass={labelClass}
                  onChange={setCategoryId}
                  options={categoryOptions}
                  placeholder="Search categories…"
                  value={categoryId}
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
              Primary image and gallery. Upload to UploadThing or paste a URL.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
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
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                value={imageUrl}
              />
              {imageUrl && (
                <div
                  className={`
                    relative mt-2 size-24 overflow-hidden rounded-md border
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
              {images.map((img, i) => (
                <div
                  className={`
                    flex flex-wrap items-start gap-2 rounded border p-2
                  `}
                  key={i}
                >
                  {img.url && (
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
                        alt=""
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        src={img.url}
                      />
                    </button>
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
                    <div className="rounded-lg border bg-card" key={oi}>
                      {/* Collapsed view */}
                      {!opt.isExpanded ? (
                        <div className="flex items-center gap-3 p-3">
                          <GripVertical
                            className={`h-4 w-4 shrink-0 text-muted-foreground`}
                          />
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
                            <GripVertical
                              className={`
                                mt-2.5 h-4 w-4 shrink-0 text-muted-foreground
                              `}
                            />
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
                                    list={`option-names-${oi}`}
                                    onChange={(e) =>
                                      updateOptionName(oi, e.target.value)
                                    }
                                    placeholder="Size"
                                    type="text"
                                    value={opt.name}
                                  />
                                  <datalist id={`option-names-${oi}`}>
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
                          onClick={() => {
                            /* Select all */
                          }}
                          type="button"
                        >
                          All
                        </button>
                        <button
                          className={`
                            text-primary
                            hover:underline
                          `}
                          onClick={() => {
                            /* Select none */
                          }}
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

                {/* No variants message */}
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
                src={expandedImageUrl}
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
            {saving ? "Creating…" : "Create product"}
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
