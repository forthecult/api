"use client";

import Link from "next/link";

import { sanitizeProductDescription } from "~/lib/sanitize-product-description";
import { slugify } from "~/lib/slugify";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import { Button } from "~/ui/primitives/button";
import { EstimatedDeliveryTimeline } from "~/app/products/[id]/estimated-delivery-timeline";
import { ProductImageGallery } from "~/app/products/[id]/product-image-gallery";
import { ProductShare } from "~/app/products/[id]/product-share";
import { ProductVariantImageProvider } from "~/app/products/[id]/product-variant-image-context";
import { ProductVariantSection } from "~/app/products/[id]/product-variant-section";
import { RelatedProductsSection } from "~/app/products/[id]/related-products-section";
import type { ProductOptionDefinition, ProductVariantOption } from "~/app/products/[id]/types";

export interface LongFormProductProps {
  product: {
    id: string;
    name: string;
    description: string;
    features: string[];
    image: string;
    images?: string[];
    mainImageAlt?: string | null;
    inStock: boolean;
    continueSellingWhenOutOfStock?: boolean;
    originalPrice?: number;
    price: number;
    category: string;
    slug?: string;
    brand?: string | null;
    model?: string | null;
    hasVariants?: boolean;
    optionDefinitions?: ProductOptionDefinition[];
    variants?: ProductVariantOption[];
    availableCountryCodes?: string[];
    handlingDaysMin?: number | null;
    handlingDaysMax?: number | null;
    transitDaysMin?: number | null;
    transitDaysMax?: number | null;
  };
  breadcrumbTrail: Array<{ name: string; href: string }>;
  discountPercentage: number;
  siteUrl: string;
  relatedProducts: Array<{
    id: string;
    slug?: string;
    name: string;
    image: string;
    category: string;
    price: number;
    originalPrice?: number;
    inStock?: boolean;
    rating?: number;
  }>;
}

export function LongFormProductPage({
  product,
  breadcrumbTrail,
  discountPercentage,
  siteUrl,
  relatedProducts,
}: LongFormProductProps) {
  const canonicalSlug = product.slug ?? product.id;
  const images = product.images?.length ? product.images : [product.image];

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="container px-4 py-6 md:px-6">
            <Breadcrumbs items={breadcrumbTrail} />
            <Link href="/products">
              <Button aria-label="Back to products" variant="ghost" className="mb-4">
                ← Back to Products
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero */}
        <section className="border-b bg-muted/20 py-12 md:py-16">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
              <ProductVariantImageProvider>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted lg:aspect-[4/3]">
                  <ProductImageGallery
                    discountPercentage={discountPercentage}
                    images={images}
                    productName={product.name}
                    mainImageAlt={product.mainImageAlt}
                  />
                </div>
              </ProductVariantImageProvider>
              <div className="flex flex-col justify-center">
                {(product.brand ?? product.model) && (
                  <p className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {[product.brand, product.model].filter(Boolean).join(" · ")}
                  </p>
                )}
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  {product.category}
                </p>
                <div className="mt-6">
                  <ProductVariantImageProvider>
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
                    />
                  </ProductVariantImageProvider>
                </div>
                <EstimatedDeliveryTimeline
                  handlingDaysMin={product.handlingDaysMin}
                  handlingDaysMax={product.handlingDaysMax}
                  transitDaysMin={product.transitDaysMin}
                  transitDaysMax={product.transitDaysMax}
                  className="mt-6"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        {product.features.length > 0 && (
          <section className="border-b py-12 md:py-16" aria-labelledby="features-heading">
            <div className="container px-4 md:px-6">
              <h2 id="features-heading" className="mb-8 text-2xl font-bold md:text-3xl">
                Features
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {product.features.map((feature) => (
                  <li
                    key={`feature-${product.id}-${slugify(feature)}`}
                    className="flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Long-form description (HTML) */}
        {product.description?.trim() && (
          <section className="border-b py-12 md:py-16" aria-labelledby="details-heading">
            <div className="container px-4 md:px-6">
              <h2 id="details-heading" className="sr-only">
                Details
              </h2>
              <div
                className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl prose-headings:font-bold prose-h2:mt-10 prose-h2:border-b prose-h2:pb-2 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-ul:my-4 prose-li:my-0.5"
                dangerouslySetInnerHTML={{
                  __html: sanitizeProductDescription(product.description),
                }}
              />
            </div>
          </section>
        )}

        {/* CTA again + share */}
        <section className="border-b py-12 md:py-16">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-xl rounded-xl border bg-card p-8 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">Ready to order?</h2>
              <ProductVariantImageProvider>
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
                />
              </ProductVariantImageProvider>
              <ProductShare
                title={product.name}
                url={`${siteUrl}/${canonicalSlug}`}
                className="mt-6"
              />
            </div>
          </div>
        </section>

        <RelatedProductsSection products={relatedProducts} />
      </main>
    </div>
  );
}
