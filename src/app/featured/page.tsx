import type { Metadata } from "next";

import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { ProductsClient } from "~/app/products/products-client";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import { CollectionPageStructuredData } from "~/ui/components/structured-data";
import { PageLoadingFallback } from "~/ui/primitives/spinner";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/featured`,
  },
  description: `Best sellers and featured products at ${SEO_CONFIG.name}. Curated picks and top sellers.`,
  openGraph: {
    description: `Best sellers and featured products at ${SEO_CONFIG.name}. Curated picks and top sellers.`,
    title: `Best Sellers | ${SEO_CONFIG.name}`,
    type: "website",
    url: `${siteUrl}/featured`,
  },
  title: "Best Sellers",
};

interface CategoryOption {
  name: string;
  slug: string;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
  }>;
}

interface Product {
  category: string;
  hasVariants?: boolean;
  id: string;
  image: string;
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  tokenGated?: boolean;
}

interface ProductsResponse {
  categories?: CategoryOption[];
  items?: Product[];
  total?: number;
  totalPages?: number;
}

export default async function FeaturedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10));
  const sortParam = params.sort?.trim() || "manual";
  const sort = [
    "best_selling",
    "manual",
    "newest",
    "price_asc",
    "price_desc",
    "rating",
  ].includes(sortParam)
    ? sortParam
    : "manual";
  const searchQuery = (params.q ?? "").trim().slice(0, 100);

  const data = await fetchFeaturedProducts(page, sort, searchQuery);
  const products = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
    tokenGated: p.tokenGated ?? false,
    tokenGatePassed:
      (p as { tokenGatePassed?: boolean }).tokenGatePassed ?? false,
  }));
  const categories: CategoryOption[] = [
    { name: "All", slug: "all" },
    { name: "Best Sellers", slug: "featured" },
    ...(data.categories ?? []),
  ];

  const description = `Browse best sellers and featured products at ${SEO_CONFIG.name}.`;

  return (
    <>
      <CollectionPageStructuredData
        description={description}
        name="Best Sellers"
        numberOfItems={data.total ?? 0}
        url={`${siteUrl}/featured`}
      />
      <Suspense fallback={<PageLoadingFallback />}>
        <ProductsClient
          breadcrumbs={[
            { href: "/", name: "Home" },
            { href: "/products", name: "Products" },
            { href: "/featured", name: "Best Sellers" },
          ]}
          description={description}
          initialCategories={categories}
          initialCategory="featured"
          initialPage={page}
          initialProducts={products}
          initialSearch={searchQuery}
          initialSort={
            sort as
              | "best_selling"
              | "manual"
              | "newest"
              | "price_asc"
              | "price_desc"
              | "rating"
          }
          initialTotal={data.total ?? 0}
          initialTotalPages={data.totalPages ?? 1}
          title="Best Sellers"
        />
      </Suspense>
    </>
  );
}

async function fetchFeaturedProducts(
  page: number,
  sort: string,
  search: string,
): Promise<ProductsResponse> {
  const baseUrl = getServerBaseUrl();
  const params = new URLSearchParams({
    category: "featured",
    limit: "12",
    page: String(page),
    sort,
  });
  if (search.trim()) params.set("q", search.trim());
  try {
    const res = await fetch(`${baseUrl}/api/products?${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { categories: [], items: [], total: 0, totalPages: 1 };
    return (await res.json()) as ProductsResponse;
  } catch {
    return { categories: [], items: [], total: 0, totalPages: 1 };
  }
}
