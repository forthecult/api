import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import { CollectionPageStructuredData } from "~/ui/components/structured-data";
import { PageLoadingFallback } from "~/ui/primitives/spinner";

import { ProductsClient } from "./products-client";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/products`,
  },
  description: `Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`,
  openGraph: {
    description: `Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`,
    title: `Products | ${SEO_CONFIG.name}`,
    type: "website",
  },
  title: "Products",
};

interface CategoryOption {
  /** Display image: category image or product fallback (not persisted). */
  image?: null | string;
  name: string;
  slug: string;
}

interface PageProps {
  searchParams: Promise<{
    category?: string;
    page?: string;
    q?: string;
    search?: string;
    sort?: string;
  }>;
}

interface Product {
  category: string;
  createdAt?: string;
  hasVariants?: boolean;
  id: string;
  image: string;
  images?: string[];
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
}

interface ProductsResponse {
  categories?: CategoryOption[];
  items?: Product[];
  page?: number;
  total?: number;
  totalPages?: number;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const categoryParam = params.category?.trim() || "";
  // Redirect /products?category=slug to /slug for clean URLs
  if (categoryParam && categoryParam !== "all") {
    redirect(
      `/${categoryParam}${params.page && Number(params.page) > 1 ? `?page=${params.page}` : ""}`,
    );
  }
  const page = Math.max(1, Number.parseInt(params.page || "1", 10));
  const limit = 12;
  const sortParam = params.sort?.trim() || "newest";
  const sort = [
    "best_selling",
    "manual",
    "newest",
    "price_asc",
    "price_desc",
    "rating",
  ].includes(sortParam)
    ? sortParam
    : "newest";
  const searchQuery = (params.q ?? params.search ?? "").trim().slice(0, 100);

  const data = await fetchProducts(
    page,
    limit,
    undefined,
    sort,
    searchQuery || undefined,
  );

  let products = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
  }));

  // SHOWCASE: randomize product order on /products — remove this block when done
  if (products.length > 1) {
    products = [...products];
    for (let i = products.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [products[i], products[j]] = [products[j], products[i]];
    }
  }

  const categories: CategoryOption[] = [
    { name: "All", slug: "all" },
    ...(data.categories ?? []),
  ];

  return (
    <>
      <CollectionPageStructuredData
        description={`Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`}
        name="All Products"
        numberOfItems={data.total ?? 0}
        url={`${siteUrl}/products`}
      />
      <Suspense fallback={<PageLoadingFallback />}>
        <ProductsClient
          initialCategories={categories}
          initialCategory="all"
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
        />
      </Suspense>
    </>
  );
}

async function fetchProducts(
  page: number,
  limit: number,
  category?: string,
  sort?: string,
  search?: string,
): Promise<ProductsResponse> {
  const baseUrl = getServerBaseUrl();
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
  });
  if (category && category !== "All") {
    params.set("category", category);
  } else {
    params.set("forStorefront", "1");
  }
  if (sort) params.set("sort", sort);
  const q = (search ?? "").trim().slice(0, 100);
  if (q) params.set("q", q);

  try {
    const res = await fetch(`${baseUrl}/api/products?${params}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (!res.ok) {
      console.error("Failed to fetch products:", res.status);
      return {
        categories: [] as CategoryOption[],
        items: [],
        total: 0,
        totalPages: 1,
      };
    }
    return (await res.json()) as ProductsResponse;
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      categories: [] as CategoryOption[],
      items: [],
      total: 0,
      totalPages: 1,
    };
  }
}
