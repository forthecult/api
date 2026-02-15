import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import {
  getAgentBaseUrl,
  getPublicSiteUrl,
  isAgentSubdomain,
} from "~/lib/app-url";

// Generate on request so build doesn't depend on DB/API (avoids timeout + 42P01 during deploy)
export const dynamic = "force-dynamic";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const isAgent = isAgentSubdomain(host);

  const siteUrl = isAgent ? getAgentBaseUrl() : getPublicSiteUrl();

  // AI subdomain: only agent-facing entry point (root redirects to /for-agents)
  if (isAgent) {
    return [
      {
        url: siteUrl,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.8,
      },
      {
        url: `${siteUrl}/for-agents`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1,
      },
    ];
  }

  async function fetchAllProducts(): Promise<ProductItem[]> {
    try {
      const res = await fetch(`${getPublicSiteUrl()}/api/products?limit=1000`, {
        next: { revalidate: 3600 },
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
      const res = await fetch(`${getPublicSiteUrl()}/api/categories`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { categories?: CategoryItem[] };
      return data.categories ?? [];
    } catch {
      return [];
    }
  }

  const [products, categories] = await Promise.all([
    fetchAllProducts(),
    fetchAllCategories(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
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
      url: `${siteUrl}/esim`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/membership`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/changelog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/token`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/token/stake`,
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
      url: `${siteUrl}/for-agents`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/track-order`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/refund`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
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
    {
      url: `${siteUrl}/sitemap`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug)
    .map((category) => ({
      url: `${siteUrl}/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/${product.slug ?? product.id}`,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
