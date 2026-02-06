import type { MetadataRoute } from "next";

// Generate on request so build doesn't depend on DB/API (avoids timeout + 42P01 during deploy)
export const dynamic = "force-dynamic";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";
  if (/^https?:\/\//i.test(raw.trim())) return raw.trim();
  return `https://${raw.trim().replace(/^\/+/, "")}`;
}
const siteUrl = getSiteUrl();

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
    // Fetch all products for sitemap (paginated, get all pages)
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

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/lookbook`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/affiliate-program`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/token`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/policies/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/policies/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/policies/refund`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/policies/shipping`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/cookies`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
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
