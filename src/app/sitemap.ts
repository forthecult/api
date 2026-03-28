import type { MetadataRoute } from "next";

import { unstable_cache } from "next/cache";
import { headers } from "next/headers";

import {
  getAgentBaseUrl,
  getPublicSiteUrl,
  isAgentSubdomain,
} from "~/lib/app-url";

// Generate on request so build doesn't depend on DB/API (avoids timeout + 42P01 during deploy)
export const dynamic = "force-dynamic";

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
}

interface ProductItem {
  id: string;
  slug?: string;
  updatedAt?: string;
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
        changeFrequency: "weekly",
        lastModified: now,
        priority: 0.8,
        url: siteUrl,
      },
      {
        changeFrequency: "weekly",
        lastModified: now,
        priority: 1,
        url: `${siteUrl}/for-agents`,
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

  async function fetchBlogSlugs(): Promise<string[]> {
    try {
      const res = await fetch(`${getPublicSiteUrl()}/api/blog/slugs`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { slugs?: string[] };
      return data.slugs ?? [];
    } catch {
      return [];
    }
  }

  async function fetchEsimPackageIds(): Promise<string[]> {
    const ids: string[] = [];
    const maxPages = 5;
    try {
      for (let page = 1; page <= maxPages; page++) {
        const res = await fetch(
          `${getPublicSiteUrl()}/api/esim/packages?page=${page}&package_type=DATA-ONLY`,
          { next: { revalidate: 3600 } },
        );
        if (!res.ok) break;
        const json = (await res.json()) as { data?: { id: string }[] };
        const items = json.data ?? [];
        if (items.length === 0) break;
        for (const pkg of items) if (pkg.id) ids.push(pkg.id);
        if (items.length < 20) break;
      }
    } catch {
      // ignore
    }
    return ids;
  }

  const getCachedSitemapData = unstable_cache(
    async () => {
      const [products, categories, esimPackageIds, blogSlugs] =
        await Promise.all([
          fetchAllProducts(),
          fetchAllCategories(),
          fetchEsimPackageIds(),
          fetchBlogSlugs(),
        ]);
      return { blogSlugs, categories, esimPackageIds, products };
    },
    ["sitemap-data"],
    { revalidate: 3600 },
  );

  const { blogSlugs, categories, esimPackageIds, products } =
    await getCachedSitemapData();

  const staticPages: MetadataRoute.Sitemap = [
    { changeFrequency: "daily", lastModified: now, priority: 1, url: siteUrl },
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 0.9,
      url: `${siteUrl}/products`,
    },
    {
      changeFrequency: "daily",
      lastModified: now,
      priority: 0.85,
      url: `${siteUrl}/featured`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.7,
      url: `${siteUrl}/about`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${siteUrl}/lookbook`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.7,
      url: `${siteUrl}/esim`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${siteUrl}/membership`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.75,
      url: `${siteUrl}/ai`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.55,
      url: `${siteUrl}/open-source`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.6,
      url: `${siteUrl}/blog`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/changelog`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${siteUrl}/token`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/token/stake`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.6,
      url: `${siteUrl}/affiliate-program`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/for-agents`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/telegram`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/contact`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/track-order`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.5,
      url: `${siteUrl}/refund`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.4,
      url: `${siteUrl}/login`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.4,
      url: `${siteUrl}/signup`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/policies/privacy`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/policies/terms`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/policies/refund`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/policies/shipping`,
    },
    {
      changeFrequency: "monthly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/cookies`,
    },
    {
      changeFrequency: "weekly",
      lastModified: now,
      priority: 0.3,
      url: `${siteUrl}/site-map`,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug)
    .map((category) => ({
      changeFrequency: "daily" as const,
      lastModified: now,
      priority: 0.8,
      url: `${siteUrl}/${category.slug}`,
    }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    changeFrequency: "weekly" as const,
    lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
    priority: 0.7,
    url: `${siteUrl}/${product.slug ?? product.id}`,
  }));

  const esimPackagePages: MetadataRoute.Sitemap = esimPackageIds.map((id) => ({
    changeFrequency: "weekly" as const,
    lastModified: now,
    priority: 0.6,
    url: `${siteUrl}/esim/${id}`,
  }));

  const blogPostPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    changeFrequency: "weekly" as const,
    lastModified: now,
    priority: 0.6,
    url: `${siteUrl}/blog/${slug}`,
  }));

  const all = [
    ...staticPages,
    ...categoryPages,
    ...productPages,
    ...esimPackagePages,
    ...blogPostPages,
  ];
  // Exclude test pages and malformed URLs (e.g. /test, or base URL with trailing &)
  const filtered = all.filter((entry) => {
    try {
      const u = new URL(entry.url);
      const path = u.pathname;
      if (path.startsWith("/test")) return false;
      if (entry.url.includes("/&") || entry.url.endsWith("&")) return false;
      return true;
    } catch {
      return true;
    }
  });
  return filtered;
}
