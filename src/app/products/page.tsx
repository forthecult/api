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
  title: "Products",
  description: `Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`,
  openGraph: {
    title: `Products | ${SEO_CONFIG.name}`,
    description: `Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`,
    type: "website",
  },
  alternates: {
    canonical: `${siteUrl}/products`,
  },
};

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

interface CategoryOption {
  slug: string;
  name: string;
  /** Display image: category image or product fallback (not persisted). */
  image?: string | null;
}

interface ProductsResponse {
  items?: Product[];
  total?: number;
  page?: number;
  totalPages?: number;
  categories?: CategoryOption[];
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
    page: String(page),
    limit: String(limit),
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
        items: [],
        total: 0,
        totalPages: 1,
        categories: [] as CategoryOption[],
      };
    }
    return res.json();
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      items: [],
      total: 0,
      totalPages: 1,
      categories: [] as CategoryOption[],
    };
  }
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    sort?: string;
    q?: string;
    search?: string;
  }>;
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
    "newest",
    "price_asc",
    "price_desc",
    "best_selling",
    "rating",
    "manual",
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

  const products = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
  }));

  const categories: CategoryOption[] = [
    { slug: "all", name: "All" },
    ...(data.categories ?? []),
  ];

  return (
    <>
      <CollectionPageStructuredData
        name="All Products"
        description={`Browse our latest products at ${SEO_CONFIG.name}. Quality apparel, tech accessories, and curated essentials.`}
        url={`${siteUrl}/products`}
        numberOfItems={data.total ?? 0}
      />
      <Suspense fallback={<PageLoadingFallback />}>
        <ProductsClient
          initialProducts={products}
          initialCategories={categories}
          initialPage={page}
          initialTotalPages={data.totalPages ?? 1}
          initialTotal={data.total ?? 0}
          initialCategory="all"
          initialSort={
            sort as
              | "newest"
              | "price_asc"
              | "price_desc"
              | "best_selling"
              | "rating"
              | "manual"
          }
          initialSearch={searchQuery}
        />
      </Suspense>
    </>
  );
}
