import type { MetadataRoute } from "next";

import { getPublicSiteUrl } from "~/lib/app-url";

// Generate on request so build doesn't depend on DB/API (avoids timeout + 42P01 during deploy)
export const dynamic = "force-dynamic";

const siteUrl = getPublicSiteUrl();

interface ProductItem {
  id: string;
  slug?: string;
  updatedAt?: string;
}

interface CategoryItem {
  id: string;
  slug?: string;
  name: string;
}

async function fetchAllProducts(): Promise<ProductItem[]> {
  try {
    // GET /api/products already excludes hidden products, so sitemap only includes listable products
    const res = await fetch(`${siteUrl}/api/products?limit=1000`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: ProductItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchAllCategories(): Promise<CategoryItem[]> {
  try {
    const res = await fetch(`${siteUrl}/api/categories`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { categories?: CategoryItem[] };
    return data.categories ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Fetch dynamic content in parallel
  const [products, categories] = await Promise.all([
    fetchAllProducts(),
    fetchAllCategories(),
  ]);

  // Static pages (public storefront only; no auth, checkout, or dashboard)
  const staticPages: MetadataRoute.Sitemap = [
    // Core storefront
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    // Brand & content
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/lookbook`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/changelog`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    // Token & ecosystem
    { url: `${siteUrl}/token`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/token/stake`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Programs
    { url: `${siteUrl}/affiliate-program`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/for-agents`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Customer service
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/track-order`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/refund`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Auth (public landing pages)
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    // Legal & info
    { url: `${siteUrl}/policies/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/policies/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/policies/refund`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/policies/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/cookies`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/sitemap`, lastModified: now, changeFrequency: "weekly", priority: 0.3 },
  ];

  // Category pages (store.com/[category-slug])
  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug)
    .map((category) => ({
      url: `${siteUrl}/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  // Product pages at base URL (store.com/[slug])
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/${product.slug ?? product.id}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
