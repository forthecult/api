import { SEO_CONFIG } from "~/app";

interface ProductStructuredDataProps {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    inStock: boolean;
    rating?: number;
    category?: string;
    /** Product URL path (store.com/[slug]). Defaults to /products/[id] if not set. */
    slug?: string;
  };
}

/**
 * JSON-LD structured data for product pages (SEO).
 * Renders as a script tag that search engines parse.
 */
export function ProductStructuredData({ product }: ProductStructuredDataProps) {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.id,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/${product.slug ?? product.id}`,
      priceCurrency: "USD",
      price: product.price,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SEO_CONFIG.name,
      },
    },
    ...(product.rating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        bestRating: 5,
        worstRating: 1,
        ratingCount: 1, // Placeholder; ideally fetch real count
      },
    }),
    ...(product.category && {
      category: product.category,
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * Organization structured data for the entire site.
 * Include in root layout or footer.
 */
export function OrganizationStructuredData() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_CONFIG.name,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: SEO_CONFIG.description,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      url: `${siteUrl}/contact`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbStructuredDataProps {
  items: BreadcrumbItem[];
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
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * WebSite structured data for sitelinks search box.
 */
export function WebSiteStructuredData() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_CONFIG.name,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

/**
 * AboutPage structured data for about pages.
 */
export function AboutPageStructuredData() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `About ${SEO_CONFIG.name}`,
    description: SEO_CONFIG.description,
    url: `${siteUrl}/about`,
    mainEntity: {
      "@type": "Organization",
      name: SEO_CONFIG.name,
      url: siteUrl,
      foundingDate: "2015",
      description:
        "For the Cult is the lifestyle brand for the age of decentralization. Premium gear, toxin-free apparel, crypto-native since 2015.",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface CollectionPageStructuredDataProps {
  name: string;
  description: string;
  url: string;
  numberOfItems?: number;
}

/**
 * CollectionPage structured data for product listing and category pages.
 */
export function CollectionPageStructuredData({
  name,
  description,
  url,
  numberOfItems,
}: CollectionPageStructuredDataProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    ...(numberOfItems != null && { numberOfItems }),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: numberOfItems ?? 0,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQStructuredDataProps {
  items: FAQItem[];
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
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
