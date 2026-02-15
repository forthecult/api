import type { Metadata } from "next";
import { Star } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import {
  getCategoryBySlug,
  getCategoryParent,
  getCategoryProductImage,
  getProductBreadcrumbTrail,
  getSubcategories,
} from "~/lib/categories";
import { getProductBySlugOrId } from "~/lib/product-by-slug";
import {
  mapProductBySlugResultToPageProduct,
  type PageProduct,
} from "~/lib/product-for-page";
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
import { ProductVariantImageProvider } from "~/app/products/[id]/product-variant-image-context";
import { ProductVariantSection } from "~/app/products/[id]/product-variant-section";
import { ProductReviewsCarousel } from "~/app/products/[id]/product-reviews-carousel";
import { RelatedProductsSection } from "~/app/products/[id]/related-products-section";
import type {
  ProductOptionDefinition,
  ProductVariantOption,
} from "~/app/products/[id]/types";
import { ProductsClient } from "~/app/products/products-client";
import { LongFormProductPage } from "~/app/[slug]/long-form-product-page";
import { getTokenGateConfig } from "~/lib/token-gate";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";

/** Always fetch product/category data from DB so variants match admin (no stale cache). */
export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/*                               Types                                        */
/* -------------------------------------------------------------------------- */

type CategoryOption = { slug: string; name: string };

interface ProductListResponse {
  items?: Array<{
    id: string;
    slug?: string;
    name: string;
    hasVariants?: boolean;
    image: string;
    category: string;
    price: number;
    originalPrice?: number;
    inStock: boolean;
    rating: number;
    /** When true, show gated thumbnail on listing pages (lock overlay, no add-to-cart). */
    tokenGated?: boolean;
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
  tokenGated?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                               Fetch helpers                                */
/* -------------------------------------------------------------------------- */

const baseUrl = () => getServerBaseUrl();

/** Resolve product by slug from DB; uses shared mapper (single source of truth). */
async function getProductForPageBySlug(
  slug: string,
): Promise<PageProduct | null> {
  const data = await getProductBySlugOrId(slug);
  if (!data) return null;
  return mapProductBySlugResultToPageProduct(data);
}

async function fetchRelatedProducts(
  slug: string,
  cookieHeader?: string,
): Promise<RelatedProduct[]> {
  try {
    const res = await fetch(
      `${baseUrl()}/api/products/${encodeURIComponent(slug)}/related`,
      {
        next: { revalidate: 60 },
        ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
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
  cookieHeader?: string,
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
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
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
  const siteUrl = getPublicSiteUrl();
  const product = await getProductForPageBySlug(slug);
  if (product) {
    const canonicalSlug = product.slug ?? product.id;
    const metaDesc =
      product.metaDescription?.trim()?.slice(0, 160) ??
      stripHtmlForMeta(product.description).slice(0, 160);
    const pageTitle = product.pageTitle?.trim() || product.name;
    const ogTitle = pageTitle.includes(SEO_CONFIG.name)
      ? pageTitle
      : `${pageTitle} | ${SEO_CONFIG.name}`;
    const canonicalUrl = `${siteUrl}/${canonicalSlug}`;
    const imageUrl =
      product.image && product.image.startsWith("http")
        ? product.image
        : product.image
          ? `${siteUrl}${product.image.startsWith("/") ? "" : "/"}${product.image}`
          : undefined;
    return {
      title: pageTitle,
      description: metaDesc,
      openGraph: {
        title: ogTitle,
        description: metaDesc,
        url: canonicalUrl,
        type: "website",
        ...(imageUrl && {
          images: [
            {
              url: imageUrl,
              alt: product.mainImageAlt ?? product.name,
              width: 1200,
              height: 630,
            },
          ],
        }),
      },
      twitter: {
        card: "summary_large_image",
        title: ogTitle,
        description: metaDesc,
        ...(imageUrl && { images: [imageUrl] }),
      },
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }
  const category = await getCategoryBySlug(slug);
  const categoryName = category?.name ?? slug;
  const title = category?.title ?? `${categoryName} | ${SEO_CONFIG.name}`;
  const description =
    category?.metaDescription?.slice(0, 160) ??
    `Browse ${categoryName} at ${SEO_CONFIG.name}.`;

  // Resolve OG image: category image → best-selling product → newest product
  let categoryImageUrl: string | undefined;
  if (category?.imageUrl) {
    categoryImageUrl = category.imageUrl;
  } else if (category) {
    const fallback = await getCategoryProductImage(category.id);
    if (fallback) categoryImageUrl = fallback;
  }
  // Ensure absolute URL for OG tags
  if (categoryImageUrl && !categoryImageUrl.startsWith("http")) {
    categoryImageUrl = `${siteUrl}${categoryImageUrl.startsWith("/") ? "" : "/"}${categoryImageUrl}`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(categoryImageUrl && {
        images: [
          {
            url: categoryImageUrl,
            alt: categoryName,
            width: 1200,
            height: 630,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(categoryImageUrl && { images: [categoryImageUrl] }),
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
  const product = await getProductForPageBySlug(slug);

  if (product) {
    const canonicalSlug = product.slug ?? product.id;
    // Redirect to canonical slug when URL is product id or wrong slug (keeps URLs consistent and avoids duplicate content)
    if (canonicalSlug && slug !== canonicalSlug) {
      redirect(`/${canonicalSlug}`);
    }
    // Only show token gate when this product is actually token-gated; otherwise show product (avoids blank page)
    const tokenGateConfig = await getTokenGateConfig("product", canonicalSlug);
    const cookieStore = await cookies();
    const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
    const passed = hasValidTokenGateCookie(tgCookie, "product", canonicalSlug);

    if (tokenGateConfig.tokenGated && !passed) {
      return (
        <TokenGateGuard resourceType="product" resourceId={canonicalSlug} />
      );
    }

    const productCookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const relatedProducts = await fetchRelatedProducts(
      slug,
      productCookieHeader,
    );
    const discountPercentage = product.originalPrice
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : 0;
    const siteUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";
    const breadcrumbTrail = await getProductBreadcrumbTrail(
      product.id,
      product.name,
      `/${canonicalSlug}`,
    );

    if (product.pageLayout === "long-form") {
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
          <LongFormProductPage
            product={product}
            breadcrumbTrail={breadcrumbTrail}
            discountPercentage={discountPercentage}
            siteUrl={siteUrl}
            relatedProducts={relatedProducts}
          />
        </>
      );
    }

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
            <div className="container mx-auto px-4 md:px-6">
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
              <ProductVariantImageProvider>
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
                    {(() => {
                      const b = product.brand?.trim();
                      const m = product.model?.trim();
                      const isProviderBrand =
                        b?.toLowerCase() === "printful" ||
                        b?.toLowerCase() === "printify" ||
                        b?.toLowerCase() === "generic brand";
                      if (!b && !m) return null;
                      if (isProviderBrand) return null;
                      return (
                        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {b && (
                            <span>
                              <span className="font-medium text-foreground">
                                Brand:
                              </span>{" "}
                              {b}
                            </span>
                          )}
                          {m && (
                            <span>
                              <span className="font-medium text-foreground">
                                Model:
                              </span>{" "}
                              {m}
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
                        continueSellingWhenOutOfStock:
                          product.continueSellingWhenOutOfStock,
                        availableCountryCodes: product.availableCountryCodes,
                        ...(product.slug && { slug: product.slug }),
                      }}
                      hasVariants={product.hasVariants ?? false}
                      optionDefinitions={product.optionDefinitions ?? []}
                      variants={product.variants ?? []}
                      handlingDaysMin={product.handlingDaysMin}
                      handlingDaysMax={product.handlingDaysMax}
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
                      description={sanitizeProductDescription(
                        product.description,
                      )}
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
              </ProductVariantImageProvider>
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
              <ProductReviewsCarousel />
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
        <TokenGateGuard resourceType="category" resourceId={category.id} />
      );
    }
  }

  // eSIM category: redirect to dedicated eSIM store
  if (category.slug === "esim") {
    redirect("/esim");
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
  const sortParam = resolvedSearchParams.sort?.trim() || "manual";
  const sort = [
    "newest",
    "price_asc",
    "price_desc",
    "best_selling",
    "rating",
    "manual",
  ].includes(sortParam)
    ? sortParam
    : "manual";
  const subcategoryParam = resolvedSearchParams.subcategory?.trim() || "";
  const searchQuery = resolvedSearchParams.q?.trim() ?? "";
  const limit = 12;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [data, subcategories, parent] = await Promise.all([
    fetchCategoryPage(
      slug,
      page,
      limit,
      sort,
      subcategoryParam || undefined,
      searchQuery || undefined,
      cookieHeader,
    ),
    getSubcategories(category.id),
    category.parentId
      ? getCategoryParent(category.parentId)
      : Promise.resolve(null),
  ]);

  const products = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
    tokenGated: p.tokenGated ?? false,
    tokenGatePassed:
      (p as { tokenGatePassed?: boolean }).tokenGatePassed ?? false,
  }));
  // First row: All + current category (no subcategory pills to avoid duplicating the second row).
  const categories: CategoryOption[] = [
    { slug: "all", name: "All" },
    ...(parent ? [parent] : []),
    ...(subcategories.length > 0
      ? [{ slug, name: category.name }]
      : subcategories),
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
          initialSort={
            sort as
              | "newest"
              | "price_asc"
              | "price_desc"
              | "best_selling"
              | "rating"
              | "manual"
          }
          initialSubcategory={subcategoryParam || undefined}
          initialSearch={searchQuery}
          breadcrumbs={[
            { name: "Home", href: "/" },
            { name: "Products", href: "/products" },
            ...(parent ? [{ name: parent.name, href: `/${parent.slug}` }] : []),
            { name: category.name, href: `/${slug}` },
          ]}
        />
      </Suspense>
    </>
  );
}
