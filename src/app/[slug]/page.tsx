import type { Metadata } from "next";

import { Star } from "lucide-react";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { LongFormProductPage } from "~/app/[slug]/long-form-product-page";
import { EstimatedDeliveryTimeline } from "~/app/products/[id]/estimated-delivery-timeline";
import { ProductDetailAccordion } from "~/app/products/[id]/product-detail-accordion";
import { ProductImageGallery } from "~/app/products/[id]/product-image-gallery";
import { ProductReviewsCarousel } from "~/app/products/[id]/product-reviews-carousel";
import { ProductShare } from "~/app/products/[id]/product-share";
import { ProductShippingEstimateProvider } from "~/app/products/[id]/product-shipping-estimate-context";
import { ProductVariantImageProvider } from "~/app/products/[id]/product-variant-image-context";
import { ProductVariantSection } from "~/app/products/[id]/product-variant-section";
import { RelatedProductsSection } from "~/app/products/[id]/related-products-section";
import { ProductsClient } from "~/app/products/products-client";
import { ProductViewAnalytics } from "~/lib/analytics/product-view-analytics";
import {
  getPublicSiteUrl,
  getServerBaseUrl,
  shouldNoindexForAgent,
} from "~/lib/app-url";
import {
  getCategoryBySlug,
  getCategoryParent,
  getCategoryProductImage,
  getProductBreadcrumbTrail,
  getSubcategories,
} from "~/lib/categories";
import { buildHreflangLanguages } from "~/lib/hreflang";
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
import {
  getCategoryTokenGates,
  getProductTokenGates,
  getTokenGateConfig,
  productPassedViaCategoryGate,
} from "~/lib/token-gate";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import { ProductBrandModel } from "~/ui/components/product-brand-model";
import { ProductFaqSection } from "~/ui/components/product-faq-section";
import {
  BreadcrumbStructuredData,
  CollectionPageStructuredData,
  ProductPageJsonLd,
} from "~/ui/components/structured-data";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { Button } from "~/ui/primitives/button";
import { Separator } from "~/ui/primitives/separator";
import { PageLoadingFallback } from "~/ui/primitives/spinner";

// the page reads cookies() for token-gate state, which already opts it into
// dynamic rendering. `force-dynamic` was redundant and prevents next from
// caching per-request data lookups via `fetch`'s `next: { revalidate }` option.
export const revalidate = 60;

/* -------------------------------------------------------------------------- */
/*                               Types                                        */
/* -------------------------------------------------------------------------- */

interface CategoryOption {
  name: string;
  slug: string;
}

interface ProductListResponse {
  categories?: CategoryOption[];
  items?: {
    category: string;
    hasVariants?: boolean;
    id: string;
    image: string;
    inStock: boolean;
    name: string;
    originalPrice?: number;
    price: number;
    rating: number;
    slug?: string;
    /** When true, show gated thumbnail on listing pages (lock overlay, no add-to-cart). */
    tokenGated?: boolean;
  }[];
  total?: number;
  totalPages?: number;
}

interface RelatedProduct {
  category: string;
  id: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  slug?: string;
  tokenGated?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               Fetch helpers                                */
/* -------------------------------------------------------------------------- */

const baseUrl = () => getServerBaseUrl();

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
    category: slug,
    limit: String(limit),
    page: String(page),
  });
  if (sort) params.set("sort", sort);
  if (subcategory) params.set("subcategory", subcategory);
  if (q?.trim()) params.set("q", q.trim());
  try {
    const res = await fetch(`${baseUrl()}/api/products?${params}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
    });
    if (!res.ok) return { categories: [], items: [], total: 0, totalPages: 1 };
    return (await res.json()) as ProductListResponse;
  } catch {
    return { categories: [], items: [], total: 0, totalPages: 1 };
  }
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
        signal: AbortSignal.timeout(5000),
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

/** Resolve product by slug from DB; uses shared mapper (single source of truth). */
async function getProductForPageBySlug(
  slug: string,
): Promise<null | PageProduct> {
  const data = await getProductBySlugOrId(slug);
  if (!data) return null;
  return mapProductBySlugResultToPageProduct(data);
}

const range = (length: number) => Array.from({ length }, (_, i) => i);

/* -------------------------------------------------------------------------- */
/*                            Metadata                                        */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
    sort?: string;
    subcategory?: string;
  }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const noindexForAgent = shouldNoindexForAgent(host);
  const siteUrl = getPublicSiteUrl();
  const product = await getProductForPageBySlug(slug);
  if (product) {
    const productGate = await getProductTokenGates(product.id);
    const canonicalSlug = product.slug ?? product.id;
    const metaDesc =
      product.metaDescription?.trim()?.slice(0, 160) ??
      stripHtmlForMeta(product.description).slice(0, 160);
    const pageTitle = product.pageTitle?.trim() || product.name;
    const ogTitle = pageTitle.includes(SEO_CONFIG.name)
      ? pageTitle
      : `${pageTitle} | ${SEO_CONFIG.name}`;
    const canonicalUrl = `${siteUrl}/${canonicalSlug}`;
    const defaultOgPath =
      "/lookbook/culture-brand-lifestyle-premium-apparel.jpg";
    const imageUrl = productGate.tokenGated
      ? `${siteUrl}${defaultOgPath}`
      : product.image?.startsWith("http")
        ? product.image
        : product.image
          ? `${siteUrl}${product.image.startsWith("/") ? "" : "/"}${product.image}`
          : `${siteUrl}${defaultOgPath}`;
    return {
      alternates: {
        canonical: canonicalUrl,
        languages: buildHreflangLanguages(`/${canonicalSlug}`),
      },
      description: metaDesc,
      openGraph: {
        description: metaDesc,
        images: [
          {
            alt: productGate.tokenGated
              ? SEO_CONFIG.name
              : (product.mainImageAlt ?? product.name),
            height: 630,
            url: imageUrl,
            width: 1200,
          },
        ],
        siteName: SEO_CONFIG.fullName,
        title: ogTitle,
        type: "website",
        url: canonicalUrl,
      },
      robots: noindexForAgent
        ? { follow: true, index: false }
        : { follow: true, index: true },
      title: pageTitle,
      twitter: {
        card: "summary_large_image",
        description: metaDesc,
        images: [imageUrl],
        title: ogTitle,
      },
    };
  }
  const category = await getCategoryBySlug(slug);
  const categoryName = category?.name ?? slug;
  const listPage = Math.max(
    1,
    Number.parseInt(resolvedSearchParams.page ?? "1", 10),
  );
  const baseCategoryTitle =
    category?.title ?? `${categoryName} | ${SEO_CONFIG.name}`;
  const title =
    category && listPage > 1
      ? `${baseCategoryTitle} — Page ${listPage}`
      : baseCategoryTitle;
  const baseDescription =
    category?.metaDescription?.slice(0, 160) ??
    `Browse ${categoryName} at ${SEO_CONFIG.name}.`;
  const description =
    category && listPage > 1
      ? `${baseDescription.slice(0, 120)}… Page ${listPage}.`.slice(0, 160)
      : baseDescription;

  const defaultOgImagePath =
    "/lookbook/culture-brand-lifestyle-premium-apparel.jpg";
  const categoryGate = category
    ? await getCategoryTokenGates(category.id)
    : { tokenGated: false };
  let categoryImageUrl: string;
  if (categoryGate.tokenGated) {
    categoryImageUrl = `${siteUrl}${defaultOgImagePath}`;
  } else {
    let url: string | undefined;
    if (category?.imageUrl) url = category.imageUrl;
    else if (category)
      url = (await getCategoryProductImage(category.id)) ?? undefined;
    if (!url) url = defaultOgImagePath;
    categoryImageUrl = url.startsWith("http")
      ? url
      : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  return {
    alternates: {
      canonical: `${siteUrl}/${slug}`,
      languages: buildHreflangLanguages(`/${slug}`),
    },
    description,
    openGraph: {
      description,
      images: [
        {
          alt: categoryGate.tokenGated ? SEO_CONFIG.name : categoryName,
          height: 630,
          url: categoryImageUrl,
          width: 1200,
        },
      ],
      siteName: SEO_CONFIG.fullName,
      title,
      type: "website",
      url: `${siteUrl}/${slug}`,
    },
    robots: noindexForAgent
      ? { follow: true, index: false }
      : { follow: true, index: true },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: [categoryImageUrl],
      title,
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
    const productCookiePassed = hasValidTokenGateCookie(
      tgCookie,
      "product",
      canonicalSlug,
    );
    const passedViaCategory = await productPassedViaCategoryGate(
      product.id,
      tgCookie,
    );
    const passed = productCookiePassed || passedViaCategory;

    if (tokenGateConfig.tokenGated && !passed) {
      return (
        <TokenGateGuard resourceId={canonicalSlug} resourceType="product" />
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

    const productJsonLd = {
      ageGroup: product.ageGroup,
      availableCountryCodes: product.availableCountryCodes,
      brand: product.brand,
      category: product.category,
      color: product.color,
      condition: product.itemCondition,
      description: stripHtmlForMeta(product.description),
      gender: product.gender,
      googleProductCategory: product.googleProductCategory,
      gtin: product.gtin,
      handlingDaysMax: product.handlingDaysMax,
      handlingDaysMin: product.handlingDaysMin,
      id: product.id,
      image: product.image,
      ...(product.images?.length ? { images: product.images } : {}),
      inStock: product.inStock,
      material: product.material,
      mpn: product.mpn,
      name: product.name,
      price: product.price,
      priceValidUntil: product.priceValidUntil,
      rating: product.rating,
      reviewCount: product.reviewCount,
      reviews: product.reviews,
      shipsFromCountry: product.shipsFromCountry,
      size: product.size,
      slug: canonicalSlug,
      transitDaysMax: product.transitDaysMax,
      transitDaysMin: product.transitDaysMin,
      variants: product.variants,
    };

    const breadcrumbJsonLd = breadcrumbTrail.map((item) => ({
      name: item.name,
      url: `${siteUrl}${item.href}`,
    }));

    if (product.pageLayout === "long-form") {
      return (
        <>
          <ProductPageJsonLd
            breadcrumbItems={breadcrumbJsonLd}
            faqItems={product.faq}
            product={productJsonLd}
          />
          <Suspense fallback={null}>
            <ProductViewAnalytics
              price={product.price}
              productId={product.id}
              productName={product.name}
            />
          </Suspense>
          <LongFormProductPage
            breadcrumbTrail={breadcrumbTrail}
            discountPercentage={discountPercentage}
            product={product}
            relatedProducts={relatedProducts}
            siteUrl={siteUrl}
          />
        </>
      );
    }

    return (
      <>
        <ProductPageJsonLd
          breadcrumbItems={breadcrumbJsonLd}
          faqItems={product.faq}
          product={productJsonLd}
        />
        <Suspense fallback={null}>
          <ProductViewAnalytics
            price={product.price}
            productId={product.id}
            productName={product.name}
          />
        </Suspense>
        <div className="flex min-h-screen flex-col">
          <main className="flex-1 py-10">
            <div
              className={`
                container mx-auto px-4
                md:px-6
              `}
            >
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
              <Suspense fallback={null}>
                <ProductVariantImageProvider>
                  <div
                    className={`
                      grid grid-cols-1 gap-8
                      md:grid-cols-2
                    `}
                  >
                    <ProductImageGallery
                      discountPercentage={discountPercentage}
                      imageAlts={product.imageAlts}
                      images={product.images ?? [product.image]}
                      mainImageAlt={product.mainImageAlt}
                      productName={product.name}
                    />
                    <ProductShippingEstimateProvider
                      availableCountryCodes={product.availableCountryCodes}
                      productId={product.id}
                    >
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
                                    className={`
                                      h-5 w-5
                                      ${
                                        i < Math.floor(product.rating)
                                          ? "fill-primary text-primary"
                                          : i < product.rating
                                            ? "fill-primary/50 text-primary"
                                            : "text-muted-foreground"
                                      }
                                    `}
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
                          <p
                            className={`
                            text-lg font-medium text-muted-foreground
                          `}
                          >
                            {product.category}
                          </p>
                        </div>
                        <ProductBrandModel
                          brand={product.brand}
                          model={product.model}
                        />
                        {/* Features only at top; description is in accordion below */}
                        {product.features.length > 0 && (
                          <ul className="mb-6 flex flex-col gap-2 text-muted-foreground">
                            {product.features.map((feature) => (
                              <li
                                className="flex items-start"
                                key={`feature-${product.id}-${slugify(feature)}`}
                              >
                                <span
                                  className={`
                                    mt-1 mr-2 h-2 w-2 shrink-0 rounded-full
                                    bg-primary
                                  `}
                                />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <ProductVariantSection
                          handlingDaysMax={product.handlingDaysMax}
                          handlingDaysMin={product.handlingDaysMin}
                          hasVariants={product.hasVariants ?? false}
                          optionDefinitions={product.optionDefinitions ?? []}
                          product={{
                            availableCountryCodes:
                              product.availableCountryCodes,
                            category: product.category,
                            continueSellingWhenOutOfStock:
                              product.continueSellingWhenOutOfStock,
                            id: product.id,
                            image: product.image,
                            inStock: product.inStock,
                            name: product.name,
                            originalPrice: product.originalPrice,
                            price: product.price,
                            ...(product.slug && { slug: product.slug }),
                          }}
                          variants={product.variants ?? []}
                        />
                        <EstimatedDeliveryTimeline
                          className="mb-6"
                          handlingDaysMax={product.handlingDaysMax}
                          handlingDaysMin={product.handlingDaysMin}
                          transitDaysMax={product.transitDaysMax}
                          transitDaysMin={product.transitDaysMin}
                        />
                        <ProductDetailAccordion
                          availableCountryCodes={product.availableCountryCodes}
                          category={product.category}
                          description={sanitizeProductDescription(
                            product.description,
                          )}
                          descriptionIsHtml
                          productId={product.id}
                          sizeChart={product.sizeChart ?? undefined}
                        />
                        <ProductFaqSection items={product.faq ?? []} />
                        <ProductShare
                          className="mt-6"
                          title={product.name}
                          url={`${siteUrl}/${canonicalSlug}`}
                        />
                      </div>
                    </ProductShippingEstimateProvider>
                  </div>
                </ProductVariantImageProvider>
              </Suspense>
              <Separator className="my-8" />
              {Object.keys(product.specs).length > 0 && (
                <div
                  className={`
                    grid grid-cols-1 gap-8
                    md:grid-cols-2
                  `}
                >
                  {Object.keys(product.specs).length > 0 && (
                    <section>
                      <h2 className="mb-4 text-2xl font-bold">
                        Specifications
                      </h2>
                      <div className="flex flex-col gap-2">
                        {Object.entries(product.specs).map(([key, value]) => (
                          <div
                            className={`
                              flex justify-between border-b pb-2 text-sm
                            `}
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
        <TokenGateGuard resourceId={category.id} resourceType="category" />
      );
    }
  }

  // eSIM category: redirect to dedicated eSIM store
  if (category.slug === "esim") {
    redirect("/esim");
  }

  const resolvedSearchParams = (await searchParams) as {
    page?: string;
    q?: string;
    sort?: string;
    subcategory?: string;
  };
  const page = Math.max(
    1,
    Number.parseInt(resolvedSearchParams.page ?? "1", 10),
  );
  const sortParam = resolvedSearchParams.sort?.trim() || "manual";
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
    { name: "All", slug: "all" },
    ...(parent ? [parent] : []),
    ...(subcategories.length > 0
      ? [{ name: category.name, slug }]
      : subcategories),
  ];

  const categoryDescription =
    category.description?.slice(0, 160) ??
    `Browse ${category.name} at ${SEO_CONFIG.name}.`;

  const publicSiteUrl = getPublicSiteUrl();
  const categoryCanonicalUrl = `${publicSiteUrl}/${slug}`;
  const breadcrumbJsonLdItems = [
    { name: "Home", url: `${publicSiteUrl}/` },
    { name: "Products", url: `${publicSiteUrl}/products` },
    ...(parent
      ? [{ name: parent.name, url: `${publicSiteUrl}/${parent.slug}` }]
      : []),
    { name: category.name, url: categoryCanonicalUrl },
  ];

  return (
    <>
      <BreadcrumbStructuredData items={breadcrumbJsonLdItems} />
      <CollectionPageStructuredData
        description={categoryDescription}
        items={products.map((p) => ({
          image: p.image,
          inStock: p.inStock,
          name: p.name,
          price: p.price,
          priceCurrency: "USD",
          url: `${publicSiteUrl}/${p.slug ?? p.id}`,
        }))}
        name={category.name}
        numberOfItems={data.total ?? 0}
        url={categoryCanonicalUrl}
      />
      <Suspense fallback={<PageLoadingFallback />}>
        <ProductsClient
          breadcrumbs={[
            { href: "/", name: "Home" },
            { href: "/products", name: "Products" },
            ...(parent ? [{ href: `/${parent.slug}`, name: parent.name }] : []),
            { href: `/${slug}`, name: category.name },
          ]}
          categoryDescriptionFull={category.description ?? undefined}
          description={categoryDescription}
          initialCategories={categories}
          initialCategory={slug}
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
          initialSubcategory={subcategoryParam || undefined}
          initialTotal={data.total ?? 0}
          initialTotalPages={data.totalPages ?? 1}
          subcategories={subcategories}
          title={category.name}
        />
      </Suspense>
    </>
  );
}
