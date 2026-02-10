import type { Metadata } from "next";
import { Star } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { SEO_CONFIG } from "~/app";
import {
  getPublicSiteUrl,
  getServerBaseUrl,
  toAbsoluteOgImageUrl,
} from "~/lib/app-url";
import { getProductBreadcrumbTrail } from "~/lib/categories";
import {
  sanitizeProductDescription,
  stripHtmlForMeta,
} from "~/lib/sanitize-product-description";
import { slugify } from "~/lib/slugify";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import {
  BreadcrumbStructuredData,
  ProductStructuredData,
} from "~/ui/components/structured-data";
import { Button } from "~/ui/primitives/button";
import { Separator } from "~/ui/primitives/separator";
import { EstimatedDeliveryTimeline } from "./estimated-delivery-timeline";
import { ProductDetailAccordion } from "./product-detail-accordion";
import { ProductImageGallery } from "./product-image-gallery";
import { ProductShare } from "./product-share";
import { ProductVariantImageProvider } from "./product-variant-image-context";
import { ProductVariantSection } from "./product-variant-section";
import { RelatedProductsSection } from "./related-products-section";
import { getTokenGateConfig } from "~/lib/token-gate";
import { COOKIE_NAME, hasValidTokenGateCookie } from "~/lib/token-gate-cookie";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";

/* -------------------------------------------------------------------------- */
/*                               Type declarations                            */
/* -------------------------------------------------------------------------- */

import type { ProductOptionDefinition, ProductVariantOption } from "./types";
export type { ProductOptionDefinition, ProductVariantOption };

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
  specs: Record<string, string>;
  hasVariants?: boolean;
  optionDefinitions?: ProductOptionDefinition[];
  variants?: ProductVariantOption[];
  handlingDaysMin?: number | null;
  handlingDaysMax?: number | null;
  transitDaysMin?: number | null;
  transitDaysMax?: number | null;
  /** When non-empty, product ships only to these countries (ISO 2-letter). */
  availableCountryCodes?: string[];
  /** Blank product brand (synced from Printful/Printify). */
  brand?: string | null;
  /** Blank product model (synced from Printful/Printify). */
  model?: string | null;
  /** Size chart for accordion when product has brand+model (e.g. apparel). */
  sizeChart?: {
    displayName: string;
    dataImperial: unknown;
    dataMetric: unknown;
  } | null;
}

/* -------------------------------------------------------------------------- */
/*                              Fetch from API                                */
/* -------------------------------------------------------------------------- */

async function fetchProductById(id: string): Promise<Product | null> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/products/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id: string;
      name: string;
      description?: string;
      price?: { usd?: number };
      compareAtPriceCents?: number;
      imageUrl?: string;
      images?: string[];
      mainImageAlt?: string | null;
      category?: string;
      inStock?: boolean;
      hasVariants?: boolean;
      optionDefinitions?: ProductOptionDefinition[];
      variants?: ProductVariantOption[];
      shipsFrom?: string | null;
      handlingDaysMin?: number | null;
      handlingDaysMax?: number | null;
      transitDaysMin?: number | null;
      transitDaysMax?: number | null;
      availableCountryCodes?: string[];
      features?: string[];
      continueSellingWhenOutOfStock?: boolean;
      brand?: string | null;
      model?: string | null;
      sizeChart?: {
        displayName: string;
        dataImperial: unknown;
        dataMetric: unknown;
      } | null;
    };
    const price = data.price?.usd ?? 0;
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
      shipsFrom: data.shipsFrom ?? null,
      specs: {},
      category: data.category ?? "Uncategorized",
      hasVariants: data.hasVariants ?? false,
      optionDefinitions: data.optionDefinitions ?? undefined,
      variants: data.variants ?? undefined,
      handlingDaysMin: data.handlingDaysMin ?? undefined,
      handlingDaysMax: data.handlingDaysMax ?? undefined,
      transitDaysMin: data.transitDaysMin ?? undefined,
      transitDaysMax: data.transitDaysMax ?? undefined,
      availableCountryCodes: data.availableCountryCodes ?? [],
      brand: data.brand ?? undefined,
      model: data.model ?? undefined,
      sizeChart: data.sizeChart ?? undefined,
    };
  } catch {
    return null;
  }
}

type RelatedProduct = {
  category: string;
  id: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  tokenGated?: boolean;
};

async function fetchRelatedProducts(
  productId: string,
  cookieHeader?: string,
): Promise<RelatedProduct[]> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/products/${productId}/related`, {
      next: { revalidate: 60 },
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: RelatedProduct[] };
    return data.items ?? [];
  } catch {
    return [];
  }
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
  const product = await fetchProductById(id);

  if (!product) {
    return {
      title: "Product Not Found",
      description: "The requested product could not be found.",
    };
  }

  const metaDesc = stripHtmlForMeta(product.description).slice(0, 160);
  const siteUrl = getPublicSiteUrl();
  const ogImageUrl = toAbsoluteOgImageUrl(product.image, siteUrl);
  return {
    title: product.name,
    description: metaDesc,
    openGraph: {
      title: `${product.name} | ${SEO_CONFIG.name}`,
      description: metaDesc,
      images: [{ url: ogImageUrl, alt: product.name }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: metaDesc,
      images: [ogImageUrl],
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
    fetchProductById(id),
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
  const passed = hasValidTokenGateCookie(tgCookie, "product", product.id);

  if (tokenGateConfig.tokenGated && !passed) {
    return <TokenGateGuard resourceType="product" resourceId={product.id} />;
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
          id: product.id,
          name: product.name,
          description: stripHtmlForMeta(product.description),
          price: product.price,
          image: product.image,
          inStock: product.inStock,
          rating: product.rating,
          category: product.category,
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
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <ProductImageGallery
                  discountPercentage={discountPercentage}
                  images={product.images ?? [product.image]}
                  productName={product.name}
                  mainImageAlt={product.mainImageAlt}
                />

                {/* Product info */}
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

                {/* Category */}
                <div className="mb-2">
                  <p className="text-lg font-medium text-muted-foreground">
                    {product.category}
                  </p>
                </div>

                {/* Brand & model: show only when brand is not the POD provider (Printful/Printify) */}
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
                          <span className="font-medium text-foreground">Brand:</span> {b}
                        </span>
                      )}
                      {m && (
                        <span>
                          <span className="font-medium text-foreground">Model:</span> {m}
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
                        key={`feature-${product.id}-${slugify(feature)}`}
                        className="flex items-start"
                      >
                        <span className="mt-1 mr-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Variant options (when present), price, stock, add to cart */}
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
                  url={`${siteUrl}/products/${product.id}`}
                  className="mt-6"
                />
                </div>
              </div>
            </ProductVariantImageProvider>

            <Separator className="my-8" />

            {/* Specs only (features are shown at top) */}
            {Object.keys(product.specs).length > 0 && (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
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
          </div>
        </main>
      </div>
    </>
  );
}
