import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import {
  buildDefaultMerchantReturnPolicy,
  buildDefaultOfferShippingDetails,
  itemConditionUrl,
} from "~/lib/merchant-policies";

export interface CollectionListItem {
  /** Optional image URL for the list item. */
  image?: string;
  /** When set with `priceCurrency` and `inStock`, embeds a stable Offer on the nested Product. */
  inStock?: boolean;
  /** Product display name (used for `ListItem.name`). */
  name?: string;
  price?: number;
  priceCurrency?: string;
  /** Absolute or relative URL to the product detail page. */
  url: string;
}

export interface FAQItem {
  answer: string;
  question: string;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

interface CollectionPageStructuredDataProps {
  description: string;
  /** Ordered items rendered on the page; emitted as `ItemList.itemListElement` so Google can match the collection to Merchant listings. */
  items?: CollectionListItem[];
  name: string;
  numberOfItems?: number;
  url: string;
}

interface FAQStructuredDataProps {
  items: FAQItem[];
}

interface OfferContext {
  conditionUrl: string;
  currency: string;
  inStockUrl: string;
  priceValidUntil?: null | string;
  productUrl: string;
  returnPolicy: Record<string, unknown>;
  shippingDetails: Record<string, unknown>;
}

interface ProductPageJsonLdProps {
  breadcrumbItems: BreadcrumbItem[];
  /** When non-empty, adds an FAQPage node to `@graph` (must match visible FAQ copy). */
  faqItems?: FAQItem[];
  product: ProductStructuredDataProps["product"];
}

/** One visible review, used to emit schema.org/Review on the Product. */
interface ProductReviewInput {
  /** Display name for the reviewer (first name or anonymized label). */
  author: string;
  /** Review body text. May be empty when the reviewer left only a rating. */
  body: null | string;
  /** Review publish date (ISO 8601). */
  createdAt: string;
  id: string;
  /** 1–5. */
  rating: number;
  /** Optional review title. */
  title: null | string;
}

/**
 * Everything a rich Google Merchant / schema.org Product listing can expose.
 * Optional fields map to Merchant feed attributes; unset → omitted from JSON-LD.
 */
interface ProductStructuredDataProps {
  product: {
    /** Audience age group: "newborn" | "infant" | "toddler" | "kids" | "adult". */
    ageGroup?: null | string;
    /** List of ISO 3166-1 alpha-2 destination countries. Used to compute OfferShippingDetails. */
    availableCountryCodes?: string[];
    brand?: null | string;
    /**
     * Path of the page that serves this JSON-LD (leading slash), when it is not
     * the default `/{slug}` storefront URL — e.g. `/products/abc123` for the legacy PDP route.
     * Ensures `Product.url`, `WebPage.@id`, and the last BreadcrumbList item stay aligned with the crawl URL.
     */
    canonicalPath?: null | string;
    category?: null | string;
    /** Primary color when variants agree or there are none. Per-variant colors come from `variants[]`. */
    color?: null | string;
    /** Item condition: "new" | "refurbished" | "used" | "damaged". Defaults to new. */
    condition?: null | string;
    /** Currency for the offer (ISO 4217). Defaults to USD. */
    currency?: null | string;
    description: string;
    /** Audience gender when uniform across variants. Per-variant genders come from `variants[]`. */
    gender?: null | string;
    /** Google product taxonomy path (for Merchant Center). */
    googleProductCategory?: null | string;
    /** Product-level GTIN (per-variant gtin comes from `variants[]`). */
    gtin?: null | string;
    /** Handling (prep) days range. */
    handlingDaysMax?: null | number;
    handlingDaysMin?: null | number;
    id: string;
    image: string;
    /** Extra gallery URLs; JSON-LD emits `image` as an array when multiple. */
    images?: string[];
    inStock: boolean;
    /** Primary material when variants agree or there are none. */
    material?: null | string;
    /** Product-level Manufacturer Part Number (per-variant mpn comes from `variants[]`). */
    mpn?: null | string;
    name: string;
    price: number;
    /** ISO string (YYYY-MM-DD) until which the price is guaranteed; recommended for sale prices. */
    priceValidUntil?: null | string;
    /** Aggregate rating value (1–5). Omit when unknown — do not invent ratings. */
    rating?: number;
    /** Number of reviews contributing to `rating`. Required by Google when `rating` is present. */
    reviewCount?: number;
    /** Up to N most recent visible reviews. Emitted as `review: [...]` on the Product. */
    reviews?: ProductReviewInput[];
    /** Ships from country (ISO 3166-1 alpha-2). */
    shipsFromCountry?: null | string;
    /** Primary size when variants agree or there are none. */
    size?: null | string;
    /** SKU. Defaults to `id` for legacy callers. */
    sku?: null | string;
    /** Product URL path (`store.com/[slug]`). Defaults to `/products/[id]` if not set. */
    slug?: string;
    /** Transit (in-carrier) days range. */
    transitDaysMax?: null | number;
    transitDaysMin?: null | number;
    /** Variant rows for multi-variant products. Becomes `hasVariant` + AggregateOffer. */
    variants?: ProductVariantInput[];
  };
}

/**
 * Per-variant identifiers + dimensions, mirroring `productVariantsTable`.
 * Emitted via `hasVariant` when a product has multiple variants so Google
 * can match each SKU to its own color/size/material/gender/GTIN.
 */
interface ProductVariantInput {
  color?: null | string;
  gender?: null | string;
  gtin?: null | string;
  id: string;
  imageUrl?: null | string;
  material?: null | string;
  mpn?: null | string;
  /** Price in the product's currency (integer cents). */
  priceCents: number;
  size?: null | string;
  sku?: null | string;
}

/**
 * AboutPage structured data for about pages.
 */
export function AboutPageStructuredData() {
  const siteUrl = getPublicSiteUrl();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    description: SEO_CONFIG.description,
    mainEntity: {
      "@type": "Organization",
      description:
        "For the Cult is the lifestyle brand for the age of decentralization. Premium gear, toxin-free apparel, crypto-native since 2015.",
      foundingDate: "2015",
      name: SEO_CONFIG.name,
      url: siteUrl,
    },
    name: `About ${SEO_CONFIG.name}`,
    url: `${siteUrl}/about`,
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * Breadcrumb structured data for navigation context.
 */
export function BreadcrumbStructuredData({
  items,
}: BreadcrumbStructuredDataProps) {
  const lastAbs =
    items.length > 0
      ? absoluteUrlForStructuredData(items[items.length - 1]?.url ?? "")
      : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    ...(lastAbs ? { "@id": `${lastAbs}#breadcrumb` } : {}),
    itemListElement: buildBreadcrumbListItemElements(items),
    numberOfItems: items.length,
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * CollectionPage structured data for product listing and category pages.
 * Embeds an `ItemList` of the actual products on the page so Merchant/SERP
 * crawlers can correlate the collection to indexed product offers.
 */
export function CollectionPageStructuredData({
  description,
  items,
  name,
  numberOfItems,
  url,
}: CollectionPageStructuredDataProps) {
  const itemList = (items ?? []).map((item, index) => {
    const urlAbs = absoluteUrlForStructuredData(item.url);
    const productNode: Record<string, unknown> = {
      "@type": "Product",
      url: urlAbs,
    };
    if (item.name?.trim()) productNode.name = item.name.trim();
    if (item.image?.trim()) {
      productNode.image = absoluteProductImageUrl(item.image.trim());
    }
    const currency = item.priceCurrency?.trim().toUpperCase();
    const canEmbedOffer =
      item.price != null &&
      Number.isFinite(item.price) &&
      Boolean(currency) &&
      typeof item.inStock === "boolean";
    if (canEmbedOffer) {
      productNode.offers = {
        "@type": "Offer",
        availability: item.inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        price: item.price,
        priceCurrency: currency,
        url: urlAbs,
      };
    }
    return {
      "@type": "ListItem",
      item: productNode,
      position: index + 1,
    };
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description,
    name,
    url,
    ...(numberOfItems != null && { numberOfItems }),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: numberOfItems ?? itemList.length,
      ...(itemList.length > 0 && { itemListElement: itemList }),
    },
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * FAQPage structured data for FAQ sections.
 */
export function FAQStructuredData({ items }: FAQStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
      name: item.question,
    })),
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * Organization structured data for the entire site.
 * Include in root layout or footer.
 */
export function OrganizationStructuredData() {
  const siteUrl = getPublicSiteUrl();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${siteUrl}/contact`,
    },
    description: SEO_CONFIG.description,
    logo: SEO_CONFIG.brandLogoUrl ?? `${siteUrl}/logo.png`,
    name: SEO_CONFIG.name,
    url: siteUrl,
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * Organization + WebSite in one tag (fewer innerHTML sites for Biome).
 */
export function OrganizationWebSiteJsonLd() {
  const siteUrl = getPublicSiteUrl();
  const graph = [
    {
      "@type": "Organization",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        url: `${siteUrl}/contact`,
      },
      description: SEO_CONFIG.description,
      logo: SEO_CONFIG.brandLogoUrl ?? `${siteUrl}/logo.png`,
      name: SEO_CONFIG.name,
      url: siteUrl,
    },
    {
      "@type": "WebSite",
      name: SEO_CONFIG.name,
      potentialAction: {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteUrl}/products?search={search_term_string}`,
        },
      },
      url: siteUrl,
    },
  ];

  return (
    <JsonLdScript
      data={{ "@context": "https://schema.org", "@graph": graph }}
    />
  );
}

/** Product + breadcrumb JSON-LD in a single script (one innerHTML instead of two). */
export function ProductPageJsonLd({
  breadcrumbItems,
  faqItems,
  product,
}: ProductPageJsonLdProps) {
  const productUrl = productCanonicalUrl(product);
  const productNodeId = `${productUrl}#product`;
  const breadcrumbNodeId = `${productUrl}#breadcrumb`;

  const graph: unknown[] = [
    productJsonLdNode(product),
    {
      "@id": productUrl,
      "@type": "WebPage",
      breadcrumb: { "@id": breadcrumbNodeId },
      mainEntity: { "@id": productNodeId },
      name: product.name,
      url: productUrl,
    },
    {
      "@id": breadcrumbNodeId,
      "@type": "BreadcrumbList",
      itemListElement: buildBreadcrumbListItemElements(breadcrumbItems),
      numberOfItems: breadcrumbItems.length,
    },
  ];

  if (faqItems && faqItems.length > 0) {
    graph.push({
      "@id": `${productUrl}#faq`,
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
        name: item.question,
      })),
    });
  }

  return (
    <JsonLdScript
      data={{ "@context": "https://schema.org", "@graph": graph }}
    />
  );
}

/**
 * JSON-LD structured data for product pages (SEO).
 * Renders as a script tag that search engines parse.
 */
export function ProductStructuredData({ product }: ProductStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    ...productJsonLdNode(product),
  };

  return <JsonLdScript data={structuredData} />;
}

/**
 * WebSite structured data for sitelinks search box.
 */
export function WebSiteStructuredData() {
  const siteUrl = getPublicSiteUrl();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_CONFIG.name,
    potentialAction: {
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/products?search={search_term_string}`,
      },
    },
    url: siteUrl,
  };

  return <JsonLdScript data={structuredData} />;
}

function absoluteProductImageUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return absoluteUrlForStructuredData(t);
}

/** Resolve relative URLs (e.g. `/foo`) against the public site origin. */
function absoluteUrlForStructuredData(raw: string): string {
  const t = raw.trim();
  if (!t) return `${getPublicSiteUrl().replace(/\/$/, "")}/`;
  try {
    if (/^https?:\/\//i.test(t)) return new URL(t).href;
    const site = `${getPublicSiteUrl().replace(/\/$/, "")}/`;
    const path = t.startsWith("/") ? t.slice(1) : t;
    return new URL(path, site).href;
  } catch {
    return t;
  }
}

function applyGtin(
  node: Record<string, unknown>,
  raw: null | string | undefined,
) {
  const gtin = raw?.trim();
  if (!gtin) return;
  node.gtin = gtin;
  if (gtin.length === 8) node.gtin8 = gtin;
  else if (gtin.length === 12) node.gtin12 = gtin;
  else if (gtin.length === 13) node.gtin13 = gtin;
  else if (gtin.length === 14) node.gtin14 = gtin;
}

function buildAggregateOffer(
  ctx: OfferContext & {
    parentSku: string;
    topLevelPrice: number;
    variants: ProductVariantInput[];
  },
) {
  const prices = ctx.variants.map((v) => v.priceCents / 100);
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);
  const offers: Record<string, unknown> = {
    "@type": "AggregateOffer",
    availability: ctx.inStockUrl,
    hasMerchantReturnPolicy: ctx.returnPolicy,
    highPrice,
    itemCondition: ctx.conditionUrl,
    lowPrice,
    offerCount: ctx.variants.length,
    // Each child Offer carries its own variant url + sku/gtin/mpn so Merchant
    // treats variants as distinct listings (blue-S ≠ red-M) rather than one URL.
    offers: ctx.variants.map((v) =>
      buildSingleOffer({
        ...ctx,
        offerUrl: variantUrl(ctx.productUrl, v.id),
        price: v.priceCents / 100,
        variantGtin: v.gtin,
        variantMpn: v.mpn,
        variantSku: variantSkuFor(ctx.parentSku, v),
      }),
    ),
    priceCurrency: ctx.currency,
    seller: sellerNode(),
    shippingDetails: ctx.shippingDetails,
    url: ctx.productUrl,
  };
  if (ctx.priceValidUntil) offers.priceValidUntil = ctx.priceValidUntil;
  return offers;
}

function buildAudience(partial: {
  ageGroup?: null | string;
  gender?: null | string;
}) {
  const gender = partial.gender?.trim();
  const ageGroup = partial.ageGroup?.trim();
  if (!gender && !ageGroup) return null;
  const audience: Record<string, unknown> = { "@type": "PeopleAudience" };
  if (gender) audience.suggestedGender = gender.toLowerCase();
  if (ageGroup) audience.suggestedAgeGroup = ageGroup.toLowerCase();
  return audience;
}

/**
 * Breadcrumb `ListItem.item` as a `WebPage` Thing (not a bare URL string) so
 * Google Search Console can reliably associate each crumb with a name/URL pair
 * (reduces "N/A" in the Breadcrumbs enhancement table).
 *
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */
function buildBreadcrumbListItemElements(items: BreadcrumbItem[]) {
  return items.map((item, index) => {
    const url = absoluteUrlForStructuredData(item.url);
    return {
      "@type": "ListItem",
      item: {
        "@id": url,
        "@type": "WebPage",
        name: item.name,
        url,
      },
      name: item.name,
      position: index + 1,
    };
  });
}

/** Build a single Offer. Optional variant context lets each variant carry its own IDs. */
function buildSingleOffer(
  ctx: OfferContext & {
    offerUrl?: string;
    price: number;
    variantGtin?: null | string;
    variantMpn?: null | string;
    variantSku?: null | string;
  },
) {
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    availability: ctx.inStockUrl,
    hasMerchantReturnPolicy: ctx.returnPolicy,
    itemCondition: ctx.conditionUrl,
    price: ctx.price,
    priceCurrency: ctx.currency,
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: ctx.price,
      priceCurrency: ctx.currency,
    },
    seller: sellerNode(),
    shippingDetails: ctx.shippingDetails,
    url: ctx.offerUrl ?? ctx.productUrl,
  };
  if (ctx.priceValidUntil) offer.priceValidUntil = ctx.priceValidUntil;
  if (ctx.variantSku?.trim()) offer.sku = ctx.variantSku.trim();
  if (ctx.variantMpn?.trim()) offer.mpn = ctx.variantMpn.trim();
  applyGtin(offer, ctx.variantGtin);
  return offer;
}

function buildVariantProduct(args: {
  conditionUrl: string;
  currency: string;
  inStockUrl: string;
  parentSku: string;
  priceValidUntil?: null | string;
  productUrl: string;
  returnPolicy: Record<string, unknown>;
  shippingDetails: Record<string, unknown>;
  variant: ProductVariantInput;
}) {
  const { variant } = args;
  const sku = variantSkuFor(args.parentSku, variant);
  const offerUrl = variantUrl(args.productUrl, variant.id);
  const node: Record<string, unknown> = {
    "@type": "Product",
    inProductGroupWithID: args.parentSku,
    offers: buildSingleOffer({
      conditionUrl: args.conditionUrl,
      currency: args.currency,
      inStockUrl: args.inStockUrl,
      offerUrl,
      price: variant.priceCents / 100,
      priceValidUntil: args.priceValidUntil,
      productUrl: args.productUrl,
      returnPolicy: args.returnPolicy,
      shippingDetails: args.shippingDetails,
      variantGtin: variant.gtin,
      variantMpn: variant.mpn,
      variantSku: sku,
    }),
    productID: sku,
    sku,
    url: offerUrl,
  };
  applyGtin(node, variant.gtin);
  if (variant.mpn?.trim()) node.mpn = variant.mpn.trim();
  if (variant.color?.trim()) node.color = variant.color.trim();
  if (variant.size?.trim()) node.size = variant.size.trim();
  if (variant.material?.trim()) node.material = variant.material.trim();
  if (variant.imageUrl?.trim()) {
    node.image = absoluteProductImageUrl(variant.imageUrl.trim());
  }
  const audience = buildAudience({
    ageGroup: null,
    gender: variant.gender ?? null,
  });
  if (audience) node.audience = audience;
  return node;
}

/**
 * Emits schema.org URLs for the axes that differ across variants.
 * Helps Google Merchant render the variant selector with the correct dimensions.
 */
function computeVariesBy(variants: ProductVariantInput[]): string[] {
  const axes: string[] = [];
  const has = (key: keyof ProductVariantInput) =>
    variants.some((v) => {
      const raw = v[key];
      return typeof raw === "string" && raw.trim().length > 0;
    });
  if (has("color")) axes.push("https://schema.org/color");
  if (has("size")) axes.push("https://schema.org/size");
  if (has("material")) axes.push("https://schema.org/material");
  if (has("gender")) axes.push("https://schema.org/suggestedGender");
  return axes;
}

function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: json-ld must be inline; payload is built server-side and safeJsonLd-escaped
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
      type="application/ld+json"
    />
  );
}

function productCanonicalUrl(
  product: ProductStructuredDataProps["product"],
): string {
  const site = getPublicSiteUrl().replace(/\/$/, "");
  const pathRaw = product.canonicalPath?.trim();
  if (pathRaw) {
    const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
    try {
      return new URL(path, `${site}/`).href;
    } catch {
      return `${site}${path}`;
    }
  }
  const slug = (product.slug ?? product.id).trim().replace(/^\/+/, "");
  return `${site}/${slug}`;
}

/** Build a single Product JSON-LD node with the full Merchant-friendly field set. */
function productJsonLdNode(product: ProductStructuredDataProps["product"]) {
  const siteUrl = getPublicSiteUrl();
  const productUrl = productCanonicalUrl(product);
  const currency = (product.currency ?? "USD").toUpperCase();
  const sku = product.sku?.trim() || product.id;
  const brand = product.brand?.trim();

  const shippingDetails = buildDefaultOfferShippingDetails(siteUrl, {
    availableCountryCodes: product.availableCountryCodes,
    currency,
    handlingDaysMax: product.handlingDaysMax,
    handlingDaysMin: product.handlingDaysMin,
    transitDaysMax: product.transitDaysMax,
    transitDaysMin: product.transitDaysMin,
  });
  const returnPolicy = buildDefaultMerchantReturnPolicy(siteUrl);
  const conditionUrl = itemConditionUrl(product.condition);
  const inStockUrl = product.inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const variants = (product.variants ?? []).filter((v) => v.priceCents >= 0);

  const offers: unknown =
    variants.length > 1
      ? buildAggregateOffer({
          conditionUrl,
          currency,
          inStockUrl,
          parentSku: sku,
          priceValidUntil: product.priceValidUntil,
          productUrl,
          returnPolicy,
          shippingDetails,
          topLevelPrice: product.price,
          variants,
        })
      : buildSingleOffer({
          conditionUrl,
          currency,
          inStockUrl,
          price: product.price,
          priceValidUntil: product.priceValidUntil,
          productUrl,
          returnPolicy,
          shippingDetails,
        });

  const primaryImage = absoluteProductImageUrl(product.image);
  const extraImages = (product.images ?? [])
    .map((u) => absoluteProductImageUrl(u.trim()))
    .filter((u) => u && u !== primaryImage);
  const imageLd =
    extraImages.length > 0
      ? Array.from(new Set([primaryImage, ...extraImages]))
      : primaryImage;

  const node: Record<string, unknown> = {
    "@id": `${productUrl}#product`,
    "@type": "Product",
    description: product.description,
    image: imageLd,
    name: product.name,
    offers,
    productID: sku,
    sku,
    url: productUrl,
  };

  // Merchant variant grouping: top-level acts as the parent/group, each
  // hasVariant child sets `inProductGroupWithID` to the same value so Google
  // treats the SKUs as one product family with individual identifiers.
  if (variants.length > 1) {
    node.productGroupID = sku;
    node.variesBy = computeVariesBy(variants);
  }

  if (brand) {
    node.brand = { "@type": "Brand", name: brand };
  }
  applyGtin(node, product.gtin);
  if (product.mpn?.trim()) node.mpn = product.mpn.trim();
  if (product.color?.trim()) node.color = product.color.trim();
  if (product.size?.trim()) node.size = product.size.trim();
  if (product.material?.trim()) node.material = product.material.trim();

  // Never fake ratings: Google flags `aggregateRating` without real reviews.
  if (
    product.rating &&
    product.rating > 0 &&
    product.reviewCount &&
    product.reviewCount > 0
  ) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      bestRating: 5,
      ratingCount: product.reviewCount,
      ratingValue: product.rating,
      worstRating: 1,
    };
  }

  // Real reviews — required alongside aggregateRating for Google Product Snippets.
  const reviews = (product.reviews ?? []).filter(
    (r) => r.rating > 0 && r.rating <= 5,
  );
  if (reviews.length > 0) {
    node.review = reviews.map((r) => {
      const review: Record<string, unknown> = {
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        datePublished: r.createdAt,
        reviewRating: {
          "@type": "Rating",
          bestRating: 5,
          ratingValue: r.rating,
          worstRating: 1,
        },
      };
      if (r.title) review.name = r.title;
      if (r.body) review.reviewBody = r.body;
      return review;
    });
  }

  const audience = buildAudience(product);
  if (audience) node.audience = audience;

  if (product.googleProductCategory?.trim()) {
    node.category = product.googleProductCategory.trim();
  } else if (product.category?.trim()) {
    node.category = product.category.trim();
  }

  // Multi-variant products also expose each variant as a child Product node
  // so Google can match each SKU to its own color/size/material/GTIN offer.
  if (variants.length > 1) {
    node.hasVariant = variants.map((v) =>
      buildVariantProduct({
        conditionUrl,
        currency,
        inStockUrl,
        parentSku: sku,
        priceValidUntil: product.priceValidUntil,
        productUrl,
        returnPolicy,
        shippingDetails,
        variant: v,
      }),
    );
  }

  return node;
}

/** Safely serialize JSON-LD data, escaping </script> to prevent injection. */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function sellerNode() {
  return {
    "@type": "Organization",
    name: SEO_CONFIG.name,
    url: getPublicSiteUrl(),
  };
}

/**
 * Canonical variant SKU: the variant's own `sku` if set, otherwise a
 * deterministic `<parentSku>-<variantId>` fallback. Guarantees every variant
 * has a unique, stable identifier for Google Merchant.
 */
function variantSkuFor(
  parentSku: string,
  variant: ProductVariantInput,
): string {
  return variant.sku?.trim() || `${parentSku}-${variant.id}`;
}

/**
 * Produces a variant-specific landing URL by appending `?variant=<id>`.
 * Each variant must have a distinct `Offer.url` or Google Merchant will
 * de-duplicate SKUs that point at the same page.
 */
function variantUrl(productUrl: string, variantId: string): string {
  const sep = productUrl.includes("?") ? "&" : "?";
  return `${productUrl}${sep}variant=${encodeURIComponent(variantId)}`;
}
