import type { Metadata } from "next";

import { Star } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import { getProductBreadcrumbTrail } from "~/lib/categories";
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
  getProductTokenGates,
  getTokenGateConfig,
  productPassedViaCategoryGate,
} from "~/lib/token-gate";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import {
  BreadcrumbStructuredData,
  ProductStructuredData,
} from "~/ui/components/structured-data";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";
import { Button } from "~/ui/primitives/button";
import { Separator } from "~/ui/primitives/separator";

import type { ProductOptionDefinition, ProductVariantOption } from "./types";

import { EstimatedDeliveryTimeline } from "./estimated-delivery-timeline";
import { ProductDetailAccordion } from "./product-detail-accordion";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductReviewsCarousel } from "./product-reviews-carousel";
import { ProductShare } from "./product-share";
import { ProductShippingEstimateProvider } from "./product-shipping-estimate-context";
import { ProductVariantImageProvider } from "./product-variant-image-context";
import { ProductVariantSection } from "./product-variant-section";
/* -------------------------------------------------------------------------- */
/*                               Type declarations                            */
/* -------------------------------------------------------------------------- */
import { RelatedProductsSection } from "./related-products-section";
export type { ProductOptionDefinition, ProductVariantOption };

interface RelatedProduct {
  category: string;
  id: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  tokenGated?: boolean;
}

async function fetchRelatedProducts(
  productId: string,
  cookieHeader?: string,
): Promise<RelatedProduct[]> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/products/${productId}/related`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: RelatedProduct[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

/** Resolve product by id from DB (no HTTP self-fetch). Uses shared mapper for single source of truth. */
async function getProductForPage(id: string): Promise<null | PageProduct> {
  const data = await getProductBySlugOrId(id);
  if (!data) return null;
  return mapProductBySlugResultToPageProduct(data);
}

const range = (length: number) => Array.from({ length }, (_, i) => i);

/* -------------------------------------------------------------------------- */
/*                            Dynamic metadata                                */
/* -------------------------------------------------------------------------- */

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductForPage(id);

  if (!product) {
    return {
      description: "The requested product could not be found.",
      title: "Product Not Found",
    };
  }

  const productGate = await getProductTokenGates(product.id);
  const metaDesc = stripHtmlForMeta(product.description).slice(0, 160);
  const siteUrl = getPublicSiteUrl();
  const defaultOgPath = "/lookbook/culture-brand-lifestyle-premium-apparel.jpg";
  const imageUrl = productGate.tokenGated
    ? `${siteUrl}${defaultOgPath}`
    : product.image?.startsWith("http")
      ? product.image
      : product.image
        ? `${siteUrl}${product.image.startsWith("/") ? "" : "/"}${product.image}`
        : `${siteUrl}${defaultOgPath}`;
  return {
    description: metaDesc,
    openGraph: {
      description: metaDesc,
      images: [
        {
          alt: productGate.tokenGated ? SEO_CONFIG.name : product.name,
          height: 630,
          url: imageUrl,
          width: 1200,
        },
      ],
      title: `${product.name} | ${SEO_CONFIG.name}`,
      type: "website",
    },
    robots: { follow: true, index: true },
    title: product.name,
    twitter: {
      card: "summary_large_image",
      description: metaDesc,
      images: [imageUrl],
      title: product.name,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [product, relatedProducts] = await Promise.all([
    getProductForPage(id),
    fetchRelatedProducts(id, cookieHeader),
  ]);

  if (!product) {
    notFound();
  }

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )
    : 0;

  const tokenGateConfig = await getTokenGateConfig("product", product.id);
  const tgCookie = cookieStore.get(COOKIE_NAME)?.value;
  const productCookiePassed = hasValidTokenGateCookie(
    tgCookie,
    "product",
    product.id,
  );
  const passedViaCategory = await productPassedViaCategoryGate(
    product.id,
    tgCookie,
  );
  const passed = productCookiePassed || passedViaCategory;

  if (tokenGateConfig.tokenGated && !passed) {
    return <TokenGateGuard resourceId={product.id} resourceType="product" />;
  }

  const siteUrl = getPublicSiteUrl();
  const breadcrumbTrail = await getProductBreadcrumbTrail(
    product.id,
    product.name,
    `/products/${product.id}`,
  );

  return (
    <>
      {/* Structured data for SEO */}
      <ProductStructuredData
        product={{
          category: product.category,
          description: stripHtmlForMeta(product.description),
          id: product.id,
          image: product.image,
          inStock: product.inStock,
          name: product.name,
          price: product.price,
          rating: product.rating,
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
          <div
            className={`
              container mx-auto px-4
              md:px-6
            `}
          >
            <Breadcrumbs items={breadcrumbTrail} />
            {/* Back link */}
            <Link href="/products">
              <Button
                aria-label="Back to products"
                className="mb-6"
                variant="ghost"
              >
                ← Back to Products
              </Button>
            </Link>

            {/* Main grid */}
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

                {/* Product info */}
                <ProductShippingEstimateProvider
                  availableCountryCodes={product.availableCountryCodes}
                  productId={product.id}
                >
                  <div className="flex flex-col">
                    {/* Title & rating (only when there are reviews) */}
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

                    {/* Category */}
                    <div className="mb-2">
                      <p className="text-lg font-medium text-muted-foreground">
                        {product.category}
                      </p>
                    </div>

                    {/* Brand & model: show only when brand is not the fulfillment provider placeholder */}
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
                        <div
                          className={`
                            mb-4 flex flex-wrap items-center gap-x-4 gap-y-1
                            text-sm text-muted-foreground
                          `}
                        >
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

                    {/* Features only at top (bullet points); description is in accordion below */}
                    {product.features.length > 0 && (
                      <ul className="mb-6 space-y-2 text-muted-foreground">
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

                    {/* Variant options (when present), price, stock, add to cart */}
                    <ProductVariantSection
                      handlingDaysMax={product.handlingDaysMax}
                      handlingDaysMin={product.handlingDaysMin}
                      hasVariants={product.hasVariants ?? false}
                      optionDefinitions={product.optionDefinitions ?? []}
                      product={{
                        availableCountryCodes: product.availableCountryCodes,
                        category: product.category,
                        continueSellingWhenOutOfStock:
                          product.continueSellingWhenOutOfStock,
                        id: product.id,
                        image: product.image,
                        inStock: product.inStock,
                        name: product.name,
                        originalPrice: product.originalPrice,
                        price: product.price,
                        slug: product.slug,
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
                      category={product.category}
                      description={sanitizeProductDescription(
                        product.description,
                      )}
                      descriptionIsHtml
                      sizeChart={product.sizeChart ?? undefined}
                    />
                    <ProductShare
                      className="mt-6"
                      title={product.name}
                      url={`${siteUrl}/products/${product.id}`}
                    />
                  </div>
                </ProductShippingEstimateProvider>
              </div>
            </ProductVariantImageProvider>

            <Separator className="my-8" />

            {/* Specs only (features are shown at top) */}
            {Object.keys(product.specs).length > 0 && (
              <div
                className={`
                  grid grid-cols-1 gap-8
                  md:grid-cols-2
                `}
              >
                {Object.keys(product.specs).length > 0 && (
                  <section>
                    <h2 className="mb-4 text-2xl font-bold">Specifications</h2>
                    <div className="space-y-2">
                      {Object.entries(product.specs).map(([key, value]) => (
                        <div
                          className="flex justify-between border-b pb-2 text-sm"
                          key={key}
                        >
                          <span className="font-medium capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                          <span className="text-muted-foreground">{value}</span>
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
