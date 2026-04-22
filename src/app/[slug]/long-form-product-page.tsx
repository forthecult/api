"use client";

import Link from "next/link";
import { Suspense } from "react";

import type {
  ProductOptionDefinition,
  ProductVariantOption,
} from "~/app/products/[id]/types";

import { EstimatedDeliveryTimeline } from "~/app/products/[id]/estimated-delivery-timeline";
import { ProductImageGallery } from "~/app/products/[id]/product-image-gallery";
import { ProductShippingEstimateForm } from "~/app/products/[id]/product-shipping-estimate-form";
import { ProductShippingEstimateProvider } from "~/app/products/[id]/product-shipping-estimate-context";
import { ProductReviewsCarousel } from "~/app/products/[id]/product-reviews-carousel";
import { ProductShare } from "~/app/products/[id]/product-share";
import { ProductVariantImageProvider } from "~/app/products/[id]/product-variant-image-context";
import { ProductVariantSection } from "~/app/products/[id]/product-variant-section";
import { RelatedProductsSection } from "~/app/products/[id]/related-products-section";
import type { ProductFaqItem } from "~/lib/product-by-slug";
import { sanitizeProductDescription } from "~/lib/sanitize-product-description";
import { slugify } from "~/lib/slugify";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import { ProductFaqSection } from "~/ui/components/product-faq-section";
import { ProductBrandModel } from "~/ui/components/product-brand-model";
import { Button } from "~/ui/primitives/button";

export interface LongFormProductProps {
  breadcrumbTrail: { href: string; name: string }[];
  discountPercentage: number;
  product: {
    availableCountryCodes?: string[];
    brand?: null | string;
    category: string;
    continueSellingWhenOutOfStock?: boolean;
    description: string;
    faq?: ProductFaqItem[];
    features: string[];
    handlingDaysMax?: null | number;
    handlingDaysMin?: null | number;
    hasVariants?: boolean;
    id: string;
    image: string;
    imageAlts?: (null | string)[];
    images?: string[];
    inStock: boolean;
    mainImageAlt?: null | string;
    model?: null | string;
    name: string;
    optionDefinitions?: ProductOptionDefinition[];
    originalPrice?: number;
    price: number;
    slug?: string;
    transitDaysMax?: null | number;
    transitDaysMin?: null | number;
    variants?: ProductVariantOption[];
  };
  relatedProducts: {
    category: string;
    id: string;
    image: string;
    inStock?: boolean;
    name: string;
    originalPrice?: number;
    price: number;
    rating?: number;
    slug?: string;
  }[];
  siteUrl: string;
}

export function LongFormProductPage({
  breadcrumbTrail,
  discountPercentage,
  product,
  relatedProducts,
  siteUrl,
}: LongFormProductProps) {
  const canonicalSlug = product.slug ?? product.id;
  const images = product.images?.length ? product.images : [product.image];

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <ProductShippingEstimateProvider
          availableCountryCodes={product.availableCountryCodes}
          productId={product.id}
        >
        <div className="border-b bg-muted/30">
          <div
            className={`
              container px-4 py-6
              md:px-6
            `}
          >
            <Breadcrumbs items={breadcrumbTrail} />
            <Link href="/products">
              <Button
                aria-label="Back to products"
                className="mb-4"
                variant="ghost"
              >
                ← Back to Products
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero */}
        <section
          className={`
            border-b bg-muted/20 py-12
            md:py-16
          `}
        >
          <div
            className={`
              container px-4
              md:px-6
            `}
          >
            <div
              className={`
                grid grid-cols-1 gap-10
                lg:grid-cols-2 lg:gap-14
              `}
            >
              <ProductVariantImageProvider>
                <div
                  className={`
                    relative aspect-square overflow-hidden rounded-lg bg-muted
                    lg:aspect-[4/3]
                  `}
                >
                  <ProductImageGallery
                    discountPercentage={discountPercentage}
                    imageAlts={product.imageAlts}
                    images={images}
                    mainImageAlt={product.mainImageAlt}
                    productName={product.name}
                  />
                </div>
              </ProductVariantImageProvider>
              <div className="flex flex-col justify-center">
                <ProductBrandModel
                  brand={product.brand}
                  className="mb-2"
                  model={product.model}
                />
                <h1
                  className={`
                    text-3xl font-bold tracking-tight
                    md:text-4xl
                    lg:text-5xl
                  `}
                >
                  {product.name}
                </h1>
                <p className="mt-3 text-lg text-muted-foreground">
                  {product.category}
                </p>
                <div className="mt-6">
                  <Suspense fallback={null}>
                    <ProductVariantImageProvider>
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
                          ...(product.slug && { slug: product.slug }),
                        }}
                        variants={product.variants ?? []}
                      />
                    </ProductVariantImageProvider>
                  </Suspense>
                </div>
                <EstimatedDeliveryTimeline
                  className="mt-6"
                  handlingDaysMax={product.handlingDaysMax}
                  handlingDaysMin={product.handlingDaysMin}
                  transitDaysMax={product.transitDaysMax}
                  transitDaysMin={product.transitDaysMin}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        {product.features.length > 0 && (
          <section
            aria-labelledby="features-heading"
            className={`
              border-b py-12
              md:py-16
            `}
          >
            <div
              className={`
                container px-4
                md:px-6
              `}
            >
              <h2
                className={`
                  mb-8 text-2xl font-bold
                  md:text-3xl
                `}
                id="features-heading"
              >
                Features
              </h2>
              <ul
                className={`
                  grid gap-4
                  sm:grid-cols-2
                  lg:grid-cols-3
                `}
              >
                {product.features.map((feature) => (
                  <li
                    className={`
                      flex items-start gap-3 rounded-lg border bg-card p-4
                      text-card-foreground
                    `}
                    key={`feature-${product.id}-${slugify(feature)}`}
                  >
                    <span
                      aria-hidden
                      className={`
                        mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary
                      `}
                    />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Long-form description (HTML) */}
        {product.description?.trim() && (
          <section
            aria-labelledby="details-heading"
            className={`
              border-b py-12
              md:py-16
            `}
          >
            <div
              className={`
                container px-4
                md:px-6
              `}
            >
              <h2 className="sr-only" id="details-heading">
                Details
              </h2>
              <div
                className={`
                  prose prose-neutral mx-auto max-w-3xl
                  dark:prose-invert
                  prose-headings:font-bold
                  prose-h2:mt-10 prose-h2:border-b prose-h2:pb-2
                  prose-h2:text-xl
                  prose-h3:mt-6 prose-h3:text-lg
                  prose-ul:my-4
                  prose-li:my-0.5
                `}
                dangerouslySetInnerHTML={{
                  __html: sanitizeProductDescription(product.description),
                }}
              />
            </div>
          </section>
        )}

        <div
          className={`
            container px-4
            md:px-6
          `}
        >
          <div className="mx-auto max-w-3xl">
            <ProductFaqSection items={product.faq ?? []} />
          </div>
        </div>

        {/* CTA again + share */}
        <section
          className={`
            border-b py-12
            md:py-16
          `}
        >
          <div
            className={`
              container px-4
              md:px-6
            `}
          >
            <div className={`mx-auto max-w-xl rounded-xl border bg-card p-8`}>
              <h2 className="mb-4 text-xl font-bold">Ready to order?</h2>
              <Suspense fallback={null}>
                <ProductVariantImageProvider>
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
                      ...(product.slug && { slug: product.slug }),
                    }}
                    variants={product.variants ?? []}
                  />
                  <div
                    className={`
                      mt-6 space-y-2 border-t border-border/60 pt-4 text-sm
                      text-muted-foreground
                    `}
                  >
                    <p>
                      Rates combine our store shipping rules with live quotes
                      from fulfillment partners when your item is produced on
                      demand.
                    </p>
                    <ProductShippingEstimateForm
                      availableCountryCodes={product.availableCountryCodes}
                      productId={product.id}
                    />
                  </div>
                </ProductVariantImageProvider>
              </Suspense>
              <ProductShare
                className="mt-6"
                title={product.name}
                url={`${siteUrl}/${canonicalSlug}`}
              />
            </div>
          </div>
        </section>

        <RelatedProductsSection products={relatedProducts} />
        <ProductReviewsCarousel />
        </ProductShippingEstimateProvider>
      </main>
    </div>
  );
}
