import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
}

interface CollectionPageStructuredDataProps {
  description: string;
  name: string;
  numberOfItems?: number;
  url: string;
}

interface FAQItem {
  answer: string;
  question: string;
}

interface FAQStructuredDataProps {
  items: FAQItem[];
}

interface ProductStructuredDataProps {
  product: {
    category?: string;
    description: string;
    id: string;
    image: string;
    inStock: boolean;
    name: string;
    price: number;
    rating?: number;
    /** Product URL path (store.com/[slug]). Defaults to /products/[id] if not set. */
    slug?: string;
  };
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

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
}

/**
 * Breadcrumb structured data for navigation context.
 */
export function BreadcrumbStructuredData({
  items,
}: BreadcrumbStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      item: item.url,
      name: item.name,
      position: index + 1,
    })),
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
}

/**
 * CollectionPage structured data for product listing and category pages.
 */
export function CollectionPageStructuredData({
  description,
  name,
  numberOfItems,
  url,
}: CollectionPageStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description,
    name,
    url,
    ...(numberOfItems != null && { numberOfItems }),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: numberOfItems ?? 0,
    },
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
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

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
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

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
}

/**
 * JSON-LD structured data for product pages (SEO).
 * Renders as a script tag that search engines parse.
 */
export function ProductStructuredData({ product }: ProductStructuredDataProps) {
  const siteUrl = getPublicSiteUrl();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    description: product.description,
    image: product.image,
    name: product.name,
    offers: {
      "@type": "Offer",
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      price: product.price,
      priceCurrency: "USD",
      seller: {
        "@type": "Organization",
        name: SEO_CONFIG.name,
      },
      url: `${siteUrl}/${product.slug ?? product.id}`,
    },
    sku: product.id,
    ...(product.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        bestRating: 5,
        ratingCount: 1, // Placeholder; ideally fetch real count
        ratingValue: product.rating,
        worstRating: 1,
      },
    }),
    ...(product.category && {
      category: product.category,
    }),
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
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

  return (
    <script
      dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      type="application/ld+json"
    />
  );
}

/** Safely serialize JSON-LD data, escaping </script> to prevent injection. */
function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
