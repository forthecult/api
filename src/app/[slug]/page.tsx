import type { Metadata } from "next";
import { Star } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { getServerBaseUrl } from "~/lib/app-url";
import {
  getCategoryBySlug,
  getCategoryParent,
  getProductBreadcrumbTrail,
  getSubcategories,
} from "~/lib/categories";
import { getProductBySlugOrId } from "~/lib/product-by-slug";
import {
  sanitizeProductDescription,
  stripHtmlForMeta,
} from "~/lib/sanitize-product-description";
import { slugify } from "~/lib/slugify";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import {
  BreadcrumbStructuredData,
  CollectionPageStructuredData,
  ProductStructuredData,
} from "~/ui/components/structured-data";
import { Button } from "~/ui/primitives/button";
import { PageLoadingFallback } from "~/ui/primitives/spinner";
import { Separator } from "~/ui/primitives/separator";
import { EstimatedDeliveryTimeline } from "~/app/products/[id]/estimated-delivery-timeline";
import { ProductDetailAccordion } from "~/app/products/[id]/product-detail-accordion";
import { ProductImageGallery } from "~/app/products/[id]/product-image-gallery";
import { ProductShare } from "~/app/products/[id]/product-share";
import { ProductVariantSection } from "~/app/products/[id]/product-variant-section";
import { RelatedProductsSection } from "~/app/products/[id]/related-products-section";
// Types re-exported from product detail page (product page lives at base [slug] now)
import type {
  ProductOptionDefinition,
  ProductVariantOption,
} from "~/app/products/[id]/page";
import { ProductsClient } from "~/app/products/products-client";
import { ESimMiniappClient } from "~/app/[slug]/esim-miniapp-client";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";

/* -------------------------------------------------------------------------- */
/*                               Types                                        */
/* -------------------------------------------------------------------------- */

type CategoryOption = { slug: string; name: string };

interface Product {
  category: string;
  description: string;
  features: string[];
  id: string;
  image: string;
  images?: string[];
  mainImageAlt?: string | null;
  inStock: boolean;
  /** When true, product can be purchased regardless of stock (POD/made-to-order). */
  continueSellingWhenOutOfStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  shipsFrom?: string | null;
  slug?: string;
  specs: Record<string, string>;
  /** When non-empty, product ships only to these countries (ISO 2-letter). */
  availableCountryCodes?: string[];
  hasVariants?: boolean;
  optionDefinitions?: ProductOptionDefinition[];
  variants?: ProductVariantOption[];
  /** Estimated delivery: handling and transit days (from fulfillment provider or manual). */
  handlingDaysMin?: number | null;
  handlingDaysMax?: number | null;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  /** Blank product brand (synced from Printful/Printify). */
  brand?: string | null;
  /** Blank product model (synced from Printful/Printify). */
  model?: string | null;
  metaDescription?: string | null;
  pageTitle?: string | null;
  /** Size chart for accordion when product has brand+model (e.g. apparel). */
  sizeChart?: {
    displayName: string;
    dataImperial: unknown;
    dataMetric: unknown;
  } | null;
}

interface ProductListResponse {
  items?: Array<{
    id: string;
    slug?: string;
    name: string;
    image: string;
    category: string;
    price: number;
    originalPrice?: number;
    inStock: boolean;
    rating: number;
  }>;
  total?: number;
  totalPages?: number;
  categories?: CategoryOption[];
}

type RelatedProduct = {
  category: string;
  id: string;
  slug?: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
};

/* -------------------------------------------------------------------------- */
/*                               Fetch helpers                                */
/* -------------------------------------------------------------------------- */

const baseUrl = () => getServerBaseUrl();

/** Resolve product by slug from DB (no self-fetch; avoids 404/cache issues). */
async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const data = await getProductBySlugOrId(slug);
  if (!data) return null;
  const price = data.price.usd ?? 0;
  const originalPrice =
    data.compareAtPriceCents != null
      ? data.compareAtPriceCents / 100
      : undefined;
  const images =
    data.images && data.images.length > 0
      ? data.images
      : data.imageUrl
        ? [data.imageUrl]
        : ["/placeholder.svg"];
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? "",
    features: data.features ?? [],
    image: data.imageUrl ?? "/placeholder.svg",
    images,
    mainImageAlt: data.mainImageAlt ?? undefined,
    inStock: data.inStock ?? true,
    continueSellingWhenOutOfStock: data.continueSellingWhenOutOfStock ?? false,
    originalPrice,
    price,
    rating: 0,
    specs: {},
    category: data.category ?? "Uncategorized",
    hasVariants: data.hasVariants ?? false,
    optionDefinitions: data.optionDefinitions ?? undefined,
    variants: data.variants ?? undefined,
    shipsFrom: data.shipsFrom ?? undefined,
    handlingDaysMin: data.handlingDaysMin ?? undefined,
    handlingDaysMax: data.handlingDaysMax ?? undefined,
    transitDaysMin: data.transitDaysMin ?? undefined,
    transitDaysMax: data.transitDaysMax ?? undefined,
    brand: data.brand ?? undefined,
    model: data.model ?? undefined,
    metaDescription: data.metaDescription ?? undefined,
    pageTitle: data.pageTitle ?? undefined,
    sizeChart: data.sizeChart ?? undefined,
    availableCountryCodes: data.availableCountryCodes ?? [],
  };
}

async function fetchRelatedProducts(slug: string): Promise<RelatedProduct[]> {
  try {
    const res = await fetch(
      `${baseUrl()}/api/products/${encodeURIComponent(slug)}/related`,
      {
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: RelatedProduct[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchCategoryPage(
  slug: string,
  page: number,
  limit: number,
  sort?: string,
  subcategory?: string,
  q?: string,
): Promise<ProductListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    category: slug,
  });
  if (sort) params.set("sort", sort);
  if (subcategory) params.set("subcategory", subcategory);
  if (q?.trim()) params.set("q", q.trim());
  try {
    const res = await fetch(`${baseUrl()}/api/products?${params}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { items: [], total: 0, totalPages: 1, categories: [] };
    return res.json();
  } catch {
    return { items: [], total: 0, totalPages: 1, categories: [] };
  }
}

const range = (length: number) => Array.from({ length }, (_, i) => i);

/* -------------------------------------------------------------------------- */
/*                            Metadata                                        */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = baseUrl();
  const product = await fetchProductBySlug(slug);
  if (product) {
    const canonicalSlug = product.slug ?? product.id;
    const metaDesc =
      product.metaDescription?.trim()?.slice(0, 160) ??
      stripHtmlForMeta(product.description).slice(0, 160);
    const pageTitle =
      product.pageTitle?.trim() || product.name;
    const ogTitle = pageTitle.includes(SEO_CONFIG.name) ? pageTitle : `${pageTitle} | ${SEO_CONFIG.name}`;
    return {
      title: pageTitle,
      description: metaDesc,
      openGraph: {
        title: ogTitle,
        description: metaDesc,
        images: [{ url: product.image, alt: product.mainImageAlt ?? product.name }],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: ogTitle,
        description: metaDesc,
        images: [product.image],
      },
      alternates: {
        canonical: `${siteUrl}/${canonicalSlug}`,
      },
    };
  }
  const category = await getCategoryBySlug(slug);
  const categoryName = category?.name ?? slug;
  const title =
    category?.title ?? `${categoryName} | ${SEO_CONFIG.name}`;
  const description =
    category?.metaDescription?.slice(0, 160) ??
    `Browse ${categoryName} at ${SEO_CONFIG.name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    alternates: {
      canonical: `${siteUrl}/${slug}`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Page                                       */
/* -------------------------------------------------------------------------- */

export default async function SlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (product) {
    const canonicalSlug = product.slug ?? product.id;
    // Redirect to canonical slug when URL is product id or wrong slug (keeps URLs consistent and avoids duplicate content)
    if (canonicalSlug && slug !== canonicalSlug) {
      redirect(`/${canonicalSlug}`);
    }
    const cookieStore = await cookies();
    const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
    const passed = hasValidTokenGateCookie(tgCookie, "product", canonicalSlug);

    if (!passed) {
      return (
        <TokenGateGuard
          resourceType="product"
          resourceId={canonicalSlug}
        />
      );
    }

    const relatedProducts = await fetchRelatedProducts(slug);
    const discountPercentage = product.originalPrice
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : 0;
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";
    const breadcrumbTrail = await getProductBreadcrumbTrail(
      product.id,
      product.name,
      `/${canonicalSlug}`,
    );

    return (
      <>
        <ProductStructuredData
          product={{
            id: product.id,
            name: product.name,
            description: stripHtmlForMeta(product.description),
            price: product.price,
            image: product.image,
            inStock: product.inStock,
            rating: product.rating,
            category: product.category,
            slug: canonicalSlug,
          }}
        />
        <BreadcrumbStructuredData
          items={breadcrumbTrail.map((item) => ({
            name: item.name,
            url: `${siteUrl}${item.href}`,
          }))}
        />
        <div className="flex min-h-screen flex-col">
          <main className="flex-1 py-10">
            <div className="container px-4 md:px-6">
              <Breadcrumbs items={breadcrumbTrail} />
              <Link href="/products">
                <Button
                  aria-label="Back to products"
                  className="mb-6"
                  variant="ghost"
                >
                  ← Back to Products
                </Button>
              </Link>
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <ProductImageGallery
                  discountPercentage={discountPercentage}
                  images={product.images ?? [product.image]}
                  productName={product.name}
                  mainImageAlt={product.mainImageAlt}
                />
                <div className="flex flex-col">
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold">{product.name}</h1>
                    {product.rating > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          aria-label={`Rating ${product.rating} out of 5`}
                          className="flex items-center"
                        >
                          {range(5).map((i) => (
                            <Star
                              className={`h-5 w-5 ${
                                i < Math.floor(product.rating)
                                  ? "fill-primary text-primary"
                                  : i < product.rating
                                    ? "fill-primary/50 text-primary"
                                    : "text-muted-foreground"
                              }`}
                              key={`star-${i}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          ({product.rating.toFixed(1)})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mb-2">
                    <p className="text-lg font-medium text-muted-foreground">
                      {product.category}
                    </p>
                  </div>
                  {(product.brand ?? product.model) && (
                    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {product.brand?.trim() && (
                        <span>
                          <span className="font-medium text-foreground">Brand:</span>{" "}
                          {product.brand.trim()}
                        </span>
                      )}
                      {product.model?.trim() && (
                        <span>
                          <span className="font-medium text-foreground">Model:</span>{" "}
                          {product.model.trim()}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Features only at top; description is in accordion below */}
                  {product.features.length > 0 && (
                    <ul className="mb-6 space-y-2 text-muted-foreground">
                      {product.features.map((feature) => (
                        <li
                          key={`feature-${product.id}-${slugify(feature)}`}
                          className="flex items-start"
                        >
                          <span className="mr-2 mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <ProductVariantSection
                    product={{
                      id: product.id,
                      name: product.name,
                      category: product.category,
                      image: product.image,
                      price: product.price,
                      originalPrice: product.originalPrice,
                      inStock: product.inStock,
                      continueSellingWhenOutOfStock: product.continueSellingWhenOutOfStock,
                      availableCountryCodes: product.availableCountryCodes,
                      ...(product.slug && { slug: product.slug }),
                    }}
                    hasVariants={product.hasVariants ?? false}
                    optionDefinitions={product.optionDefinitions ?? []}
                    variants={product.variants ?? []}
                  />
                  <EstimatedDeliveryTimeline
                    handlingDaysMin={product.handlingDaysMin}
                    handlingDaysMax={product.handlingDaysMax}
                    transitDaysMin={product.transitDaysMin}
                    transitDaysMax={product.transitDaysMax}
                    className="mb-6"
                  />
                  <ProductDetailAccordion
                    category={product.category}
                    description={sanitizeProductDescription(product.description)}
                    descriptionIsHtml
                    sizeChart={product.sizeChart ?? undefined}
                  />
                  <ProductShare
                    title={product.name}
                    url={`${siteUrl}/${canonicalSlug}`}
                    className="mt-6"
                  />
                </div>
              </div>
              <Separator className="my-8" />
              {Object.keys(product.specs).length > 0 && (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  {Object.keys(product.specs).length > 0 && (
                    <section>
                      <h2 className="mb-4 text-2xl font-bold">
                        Specifications
                      </h2>
                      <div className="space-y-2">
                        {Object.entries(product.specs).map(([key, value]) => (
                          <div
                            className="flex justify-between border-b pb-2 text-sm"
                            key={key}
                          >
                            <span className="font-medium capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span className="text-muted-foreground">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
              <RelatedProductsSection products={relatedProducts} />
            </div>
          </main>
        </div>
      </>
    );
  }

  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  if (category.tokenGated) {
    const cookieStore = await cookies();
    const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
    const passed = hasValidTokenGateCookie(tgCookie, "category", category.id);
    if (!passed) {
      return (
        <TokenGateGuard
          resourceType="category"
          resourceId={category.id}
        />
      );
    }
  }

  // eSIM category: embed Boxo eSIM miniapp (travel data plans)
  if (category.slug === "esim") {
    const categoryDescription =
      category.description?.slice(0, 160) ??
      `Browse ${category.name} at ${SEO_CONFIG.name}.`;
    return (
      <>
        <CollectionPageStructuredData
          name={category.name}
          description={categoryDescription}
          url={`${baseUrl()}/${slug}`}
          numberOfItems={0}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              {category.name}
            </h1>
            {category.description ? (
              <p className="mt-4 max-w-3xl text-muted-foreground">
                {category.description}
              </p>
            ) : null}
          </div>
          <ESimMiniappClient />
        </div>
      </>
    );
  }

  const resolvedSearchParams = (await searchParams) as {
    page?: string;
    sort?: string;
    subcategory?: string;
    q?: string;
  };
  const page = Math.max(
    1,
    Number.parseInt(resolvedSearchParams.page ?? "1", 10),
  );
  const sortParam = resolvedSearchParams.sort?.trim() || "newest";
  const sort =
    ["newest", "price_asc", "price_desc", "best_selling", "rating"].includes(
      sortParam,
    )
      ? sortParam
      : "newest";
  const subcategoryParam = resolvedSearchParams.subcategory?.trim() || "";
  const searchQuery = resolvedSearchParams.q?.trim() ?? "";
  const limit = 12;

  const [data, subcategories, parent] = await Promise.all([
    fetchCategoryPage(slug, page, limit, sort, subcategoryParam || undefined, searchQuery || undefined),
    getSubcategories(category.id),
    category.parentId ? getCategoryParent(category.parentId) : Promise.resolve(null),
  ]);

  const products = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
  }));
  // On a category page: All, parent category (if any), and this category's subcategories.
  const categories: CategoryOption[] = [
    { slug: "all", name: "All" },
    ...(parent ? [parent] : []),
    ...subcategories,
  ];

  const categoryDescription =
    category.description?.slice(0, 160) ??
    `Browse ${category.name} at ${SEO_CONFIG.name}.`;

  return (
    <>
      <CollectionPageStructuredData
        name={category.name}
        description={categoryDescription}
        url={`${baseUrl()}/${slug}`}
        numberOfItems={data.total ?? 0}
      />
    <Suspense fallback={<PageLoadingFallback />}>
      <ProductsClient
        initialProducts={products}
        initialCategories={categories}
        initialPage={page}
        initialTotalPages={data.totalPages ?? 1}
        initialTotal={data.total ?? 0}
        initialCategory={slug}
        title={category.name}
        description={categoryDescription}
        categoryDescriptionFull={category.description ?? undefined}
        subcategories={subcategories}
        initialSort={sort as "newest" | "price_asc" | "price_desc" | "best_selling" | "rating"}
        initialSubcategory={subcategoryParam || undefined}
        initialSearch={searchQuery}
      />
    </Suspense>
    </>
  );
}
