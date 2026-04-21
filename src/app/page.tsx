import type { Metadata } from "next";

import {
  ArrowRight,
  Clock,
  Globe,
  Shield,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import nextDynamic from "next/dynamic";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import { getCategoriesWithProductsAndDisplayImage } from "~/lib/categories";
import { SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG } from "~/lib/storefront-categories";
import { PageContainer } from "~/ui/components/layout/page-container";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Skeleton } from "~/ui/primitives/skeleton";

import { testimonials as mockTestimonials } from "./mocks";

const FeaturedProductsSection = nextDynamic(
  () =>
    import("~/app/FeaturedProductsSection").then((m) => ({
      default: m.FeaturedProductsSection,
    })),
  {
    loading: () => (
      <div
        className={`
          grid grid-cols-1 gap-6
          sm:grid-cols-2
          lg:grid-cols-3
          xl:grid-cols-4
        `}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton
            className="h-80 w-full rounded-lg"
            key={`fp-skeleton-${i}`}
          />
        ))}
      </div>
    ),
    ssr: true,
  },
);

/** Below-the-fold: load testimonials section in a separate chunk to reduce initial JS. */
const LazyTestimonialsSection = nextDynamic(
  () =>
    import("~/ui/components/testimonials/testimonials-with-marquee").then(
      (m) => ({ default: m.TestimonialsSection }),
    ),
  {
    loading: () => (
      <div
        className={`
          flex flex-col items-center gap-4 py-12
          sm:py-24
        `}
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="mt-8 flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton className="h-48 w-[280px] shrink-0 rounded-lg" key={i} />
          ))}
        </div>
      </div>
    ),
    ssr: true,
  },
);

// Avoid build-time SSG timeout when API/DB unreachable (e.g. Railway build)
export const dynamic = "force-dynamic";

interface TestimonialItem {
  author: { avatar?: string; handle?: string; name: string };
  productTitle?: string;
  rating?: number;
  text: string;
}

async function fetchCategories(): Promise<
  { id: string; name: string; productCount: number; slug?: string }[]
> {
  const baseUrl =
    process.env.NEXT_SERVER_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/categories`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      categories?: {
        id: string;
        name: string;
        productCount?: number;
        slug?: string;
      }[];
    };
    return (data.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      productCount: c.productCount ?? 0,
      slug: c.slug,
    }));
  } catch {
    return [];
  }
}

async function fetchFeaturedProducts(cookieHeader?: string): Promise<
  {
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
    tokenGated?: boolean;
    tokenGatePassed?: boolean;
  }[]
> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(
      `${baseUrl}/api/products?page=1&limit=8&category=__featured__&sort=manual`,
      {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
        ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        category?: string;
        hasVariants?: boolean;
        id: string;
        image?: string;
        inStock?: boolean;
        name: string;
        originalPrice?: number;
        price?: number;
        rating?: number;
        slug?: string;
        tokenGated?: boolean;
        tokenGatePassed?: boolean;
      }[];
    };
    return (data.items ?? []).map((p) => ({
      category: p.category ?? "Uncategorized",
      hasVariants: p.hasVariants ?? false,
      id: p.id,
      image: p.image ?? "/placeholder.svg",
      inStock: p.inStock ?? true,
      name: p.name,
      originalPrice: p.originalPrice,
      price: p.price ?? 0,
      rating: p.rating ?? 0,
      slug: p.slug,
      tokenGated: p.tokenGated,
      tokenGatePassed: p.tokenGatePassed ?? false,
    }));
  } catch {
    return [];
  }
}

async function fetchReviewsForTestimonials(): Promise<TestimonialItem[]> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(
      `${baseUrl}/api/reviews?limit=20&includeProductName=true`,
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: {
        comment: string;
        displayName: string;
        id: string;
        productName?: null | string;
        rating: number;
      }[];
    };
    const items = data.items ?? [];
    if (items.length === 0) return [];
    return items.map((r) => ({
      author: { name: r.displayName },
      productTitle: r.productName ?? undefined,
      rating: r.rating,
      text: r.comment,
    }));
  } catch {
    return [];
  }
}

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/`,
  },
  description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
  openGraph: {
    description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
    title: SEO_CONFIG.fullName,
    type: "website",
  },
  title: SEO_CONFIG.fullName,
};

const featuresWhyChooseUs = [
  {
    description:
      "Free shipping on orders over $200. Fast, reliable delivery worldwide. Cult members get free shipping on most orders.",
    icon: <Truck className="h-5 w-5 text-primary" />,
    title: "Free worldwide shipping",
  },
  {
    description:
      "Pay with card, crypto, or SOL. Secure encryption, guest-friendly checkout. Your data, your rules.",
    icon: <Shield className="h-5 w-5 text-primary" />,
    title: "Pay your way",
  },
  {
    description:
      "Real humans, real responses. Our support team is here for orders, returns, and questions.",
    icon: <Clock className="h-5 w-5 text-primary" />,
    title: "Support when you need it",
  },
  {
    description:
      "Every product is tested by the community. 30-day money-back guarantee.",
    icon: <Star className="h-5 w-5 text-primary" />,
    title: "Quality guarantee",
  },
];

const EXCLUDED_SLUGS = [
  "currency",
  "network",
  "dapp",
  SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG,
];

/* ---------------------------------------------------------------------------
 * Main page — fetch all data up front, then render (no Suspense streaming)
 * ------------------------------------------------------------------------- */

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const settled = await Promise.allSettled([
    fetchCategories(),
    getCategoriesWithProductsAndDisplayImage({ topLevelOnly: true }),
    fetchFeaturedProducts(cookieHeader),
    fetchReviewsForTestimonials(),
  ]);
  const shopCategories =
    settled[0].status === "fulfilled" ? settled[0].value : [];
  const categoriesWithImage =
    settled[1].status === "fulfilled" ? settled[1].value : [];
  const featuredProducts =
    settled[2].status === "fulfilled" ? settled[2].value : [];
  const reviewTestimonials =
    settled[3].status === "fulfilled" ? settled[3].value : [];
  for (const [i, r] of settled.entries()) {
    if (r.status === "rejected") {
      console.error(`[HomePage] data fetch failed (index ${i}):`, r.reason);
    }
  }

  const topLevelShopFiltered = shopCategories.filter(
    (c) => c.slug && c.productCount > 0 && !EXCLUDED_SLUGS.includes(c.slug),
  );
  const imageBySlug = new Map(
    categoriesWithImage
      .filter((c) => c.image)
      .map((c) => [c.slug, c.image] as const),
  );
  const topLevelShop = topLevelShopFiltered.map((c) => ({
    ...c,
    image: imageBySlug.get(c.slug ?? "") ?? null,
  }));

  const testimonials: TestimonialItem[] =
    reviewTestimonials.length > 0 ? reviewTestimonials : mockTestimonials;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero — immediate, no data needed */}
      <section
        className={`
          hero-scanlines relative overflow-hidden py-28
          md:py-40
        `}
      >
        {/* Dot grid background */}
        <div
          className={`
            bg-dot-grid absolute inset-0 opacity-50
            dark:opacity-100
          `}
        />
        {/* Radial amber glow at top-center */}
        <div
          className={`
            absolute inset-0
            bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(196,135,58,0.12),transparent)]
            opacity-40
            dark:opacity-100
          `}
        />
        <PageContainer className="relative z-10">
          <div className="mx-auto w-full max-w-4xl text-center">
            <div
              className={`
                mb-6 inline-flex items-center gap-2 rounded-full border
                border-border bg-card/80 px-4 py-1.5 text-sm font-medium
                tracking-[0.15em] text-muted-foreground uppercase
                backdrop-blur-sm
                dark:border-border dark:bg-card/80
              `}
            >
              <Zap className="h-3 w-3 text-primary" />
              For the Cult
            </div>
            <h1
              className={`
                font-heading-lcp text-4xl leading-tight font-extrabold
                tracking-tight text-foreground
                sm:text-5xl
                md:text-7xl
                lg:leading-[1.05]
              `}
            >
              Where culture and{" "}
              <span className="text-gradient-brand">technology</span> converge
            </h1>
            <p
              className={`
                mx-auto mt-6 max-w-2xl text-lg text-muted-foreground
                md:text-xl
              `}
            >
              Curated tech, premium apparel, wellness gear, and travel
              essentials — for people who invest in themselves and the future
              they&apos;re building.
            </p>
            <div
              className={`
                mt-10 flex flex-col items-center justify-center gap-4
                sm:flex-row
              `}
            >
              <Link href="/products">
                <Button
                  className="h-12 gap-2 px-8 text-sm tracking-wider uppercase"
                  size="lg"
                >
                  Enter the shop <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  className="h-12 px-8 text-sm tracking-wider uppercase"
                  size="lg"
                  variant="outline"
                >
                  Read the manifesto
                </Button>
              </Link>
            </div>
            {/* Trust signals */}
            <div
              className={`
                mt-12 flex flex-wrap items-center justify-center gap-6 text-sm
                tracking-wider text-muted-foreground uppercase
                dark:text-muted-foreground
              `}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary/70" />
                <span>Ships worldwide</span>
              </div>
              <div
                className={`
                  h-3 w-px bg-border
                  dark:bg-border
                `}
              />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary/70" />
                <span>Card &amp; crypto</span>
              </div>
              <div
                className={`
                  h-3 w-px bg-border
                  dark:bg-border
                `}
              />
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary/70" />
                <span>Free shipping over $200</span>
              </div>
            </div>
          </div>
        </PageContainer>
        {/* Bottom amber gradient line */}
        <div
          className={`
            absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent
            via-primary/30 to-transparent
          `}
        />
      </section>

      {/* Featured products — just below the fold */}
      <section
        className={`
          bg-background py-20
          md:py-28
        `}
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          <div className="mb-12 flex flex-col items-center text-center">
            <h2
              className={`
                font-heading text-3xl font-bold tracking-tight text-foreground
                md:text-4xl
              `}
            >
              Featured products
            </h2>
            <div
              className={`
                mt-3 h-0.5 w-16 bg-gradient-to-r from-primary to-primary/30
              `}
            />
            <p
              className={`
                mt-4 max-w-2xl text-base text-muted-foreground
                md:text-lg
              `}
            >
              Tech, apparel, wellness, and travel gear for how you live
            </p>
          </div>
          <div
            className={`
              grid grid-cols-1 gap-6
              sm:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-4
            `}
          >
            <FeaturedProductsSection products={featuredProducts} />
          </div>
          <div className="mt-12 flex justify-center">
            <Link href="/products">
              <Button
                className="group h-12 px-8 text-sm tracking-wider uppercase"
                size="lg"
                variant="outline"
              >
                View all products
                <ArrowRight
                  className={`
                    ml-2 h-4 w-4 transition-transform duration-300
                    group-hover:translate-x-1
                  `}
                />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Brand statement — immediate, no data needed */}
      <section
        className={`
          py-20
          md:py-28
        `}
      >
        <PageContainer>
          <div className="mx-auto w-full max-w-3xl space-y-8 text-center">
            <p
              className={`
                text-xs font-medium tracking-[0.2em] text-primary uppercase
              `}
            >
              A lifestyle for the independent
            </p>
            <h2
              className={`
                font-heading text-2xl leading-snug font-bold text-foreground
                md:text-4xl
              `}
            >
              We curate tech, apparel, wellness, and travel gear that fits how
              you live — and the future you&apos;re building.
            </h2>
            <p
              className={`
                text-base text-muted-foreground
                md:text-lg
              `}
            >
              Join as a member for product discounts, free shipping, exclusive
              drops, and early access to new arrivals. This isn&apos;t just a
              store — it&apos;s a signal.
            </p>
            <Link href="/membership">
              <Button
                className="text-sm tracking-wider uppercase"
                size="lg"
                variant="outline"
              >
                Join the cult
              </Button>
            </Link>
          </div>
        </PageContainer>
      </section>

      {/* Thin divider */}
      <div
        className={`
          mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent
          via-border to-transparent
        `}
      />

      {/* Featured categories — streamed (needs categories API) */}
      <section
        className={`
          py-20
          md:py-28
        `}
      >
        <PageContainer>
          <div className="mb-12 flex flex-col items-center text-center">
            <p
              className={`
                text-xs font-medium tracking-[0.2em] text-primary uppercase
              `}
            >
              Collections
            </p>
            <h2
              className={`
                font-heading mt-3 text-3xl font-bold tracking-tight
                text-foreground
                md:text-4xl
              `}
            >
              Shop by category
            </h2>
            <div
              className={`
                mt-3 h-0.5 w-16 bg-gradient-to-r from-primary to-primary/30
              `}
            />
            <p
              className={`
                mt-4 max-w-2xl text-base text-muted-foreground
                md:text-lg
              `}
            >
              Browse tech, apparel, wellness, and travel essentials — each
              category chosen for quality
            </p>
          </div>
          <div
            className={`
              grid grid-cols-2 gap-4
              md:grid-cols-3 md:gap-5
              lg:grid-cols-6
            `}
          >
            {topLevelShop.length > 0 ? (
              topLevelShop.map((category, index) => (
                <Link
                  aria-label={`Browse ${category.name} products`}
                  className={`
                    cult-glow group flex flex-col overflow-hidden rounded-lg
                    border border-border bg-card transition-all duration-300
                  `}
                  href={`/${category.slug ?? category.id}`}
                  key={category.id}
                >
                  <div
                    className={`
                      relative aspect-[4/3] w-full shrink-0 overflow-hidden
                      bg-card
                    `}
                  >
                    <Image
                      alt=""
                      className={`
                        object-contain transition-transform duration-300
                        group-hover:scale-105
                      `}
                      fill
                      priority={index < 2}
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 192px"
                      src={
                        category.image ??
                        (category.slug === "featured"
                          ? "/featured-placeholder.svg"
                          : "/placeholder.svg")
                      }
                      unoptimized={
                        (category.image ?? "").startsWith("data:") ||
                        (category.image ?? "").startsWith("http://")
                      }
                    />
                  </div>
                  <div className="flex flex-col p-5">
                    <div
                      className={`
                        text-base font-medium text-foreground transition-colors
                        group-hover:text-primary
                      `}
                    >
                      {category.name}
                    </div>
                    <p
                      className={`
                        font-mono-crypto mt-1 text-xs text-muted-foreground
                      `}
                    >
                      {category.productCount} products
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <Link
                className={`
                  cult-glow rounded-lg border border-border bg-card p-5
                `}
                href="/products"
              >
                <div className="text-base font-medium text-foreground">
                  All Products
                </div>
                <p className="text-xs text-muted-foreground">
                  Browse the store
                </p>
              </Link>
            )}
          </div>
        </PageContainer>
      </section>

      {/* Thin divider */}
      <div
        className={`
          mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent
          via-border to-transparent
        `}
      />

      {/* Lookbook — immediate, no data needed */}
      <section
        className={`
          bg-background py-20
          md:py-28
        `}
      >
        <PageContainer>
          <div className="mx-auto w-full max-w-3xl space-y-4 text-center">
            <p
              className={`
                text-xs font-medium tracking-[0.2em] text-primary uppercase
              `}
            >
              Lookbook
            </p>
            <h2
              className={`
                font-heading text-2xl font-bold tracking-tight text-foreground
                md:text-3xl
              `}
            >
              Quality that looks good and does good
            </h2>
            <p
              className={`
                text-base text-muted-foreground
                md:text-lg
              `}
            >
              What you wear and use should look great and support how you feel.
              Apparel we&apos;d use ourselves.
            </p>
            <Link href="/lookbook">
              <Button
                className="mt-2 text-sm tracking-wider uppercase"
                size="lg"
                variant="outline"
              >
                View lookbook
              </Button>
            </Link>
          </div>
          <div className="mx-auto mt-12 w-full max-w-6xl">
            <Link
              className={`
                group relative block overflow-hidden rounded-lg border
                border-border transition-all duration-300
                hover:border-primary/20
              `}
              href="/lookbook"
            >
              <div
                className={`
                  absolute inset-0 z-10 bg-gradient-to-t from-background/60
                  via-transparent to-transparent
                `}
              />
              <Image
                alt="Culture lookbook — premium apparel and lifestyle photography. Photos by George J. Patterson."
                className={`
                  h-auto w-full object-cover transition-transform duration-700
                  group-hover:scale-[1.02]
                `}
                height={600}
                priority
                sizes="(max-width: 896px) 100vw, 900px"
                src="/lookbook/culture-lookbook-lifestyle-and-apparel.jpg"
                title="Culture lookbook"
                width={900}
              />
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Photos by George J. Patterson
            </p>
          </div>
        </PageContainer>
      </section>

      {/* Why choose us — immediate, no data needed */}
      <section
        className={`
          py-20
          md:py-28
        `}
        id="features"
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          <div className="mb-12 flex flex-col items-center text-center">
            <p
              className={`
                text-sm font-medium tracking-[0.2em] text-primary uppercase
              `}
            >
              The standard
            </p>
            <h2
              className={`
                font-heading mt-3 text-3xl font-bold tracking-tight
                text-foreground
                md:text-4xl
              `}
            >
              Why choose us
            </h2>
            <div
              className={`
                mt-3 h-0.5 w-16 bg-gradient-to-r from-primary to-primary/30
              `}
            />
            <p
              className={`
                mt-4 max-w-2xl text-base text-muted-foreground
                md:text-lg
              `}
            >
              Secure checkout, crypto or card, free shipping over $200, and real
              support when you need it
            </p>
          </div>
          <div
            className={`
              grid gap-6
              md:grid-cols-2
              lg:grid-cols-4
            `}
          >
            {featuresWhyChooseUs.map((feature) => (
              <Card
                className={`
                  cult-glow rounded-lg border border-border bg-card shadow-none
                  transition-all duration-300
                  dark:border-border dark:bg-card
                `}
                key={feature.title}
              >
                <CardHeader className="pb-2">
                  <div
                    className={`
                      mb-3 flex h-10 w-10 items-center justify-center rounded-lg
                      border border-primary/20 bg-primary/10
                    `}
                  >
                    {feature.icon}
                  </div>
                  <CardTitle
                    className={`text-base font-semibold text-foreground`}
                  >
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Thin divider */}
      <div
        className={`
          mx-auto h-px w-full max-w-7xl bg-gradient-to-r from-transparent
          via-border to-transparent
        `}
      />

      {/* Testimonials — streamed (needs reviews API); full-bleed dark bg, content stays in container */}
      <section
        className={`
          w-full bg-[#0D0D0D] py-20
          md:py-28
        `}
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          <LazyTestimonialsSection
            className="py-0"
            description="Reviews from people who've ordered"
            testimonials={testimonials}
            title="From the community"
          />
        </div>
      </section>

      {/* CTA — immediate, no data needed */}
      <section
        className={`
          py-20
          md:py-28
        `}
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          <div
            className={`
              relative overflow-hidden rounded-lg border border-border bg-card
              p-10
              md:p-16
            `}
          >
            {/* Ambient amber glow */}
            <div
              className={`
                absolute inset-0
                bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(196,135,58,0.06),transparent)]
              `}
            />
            <div className="bg-dot-grid absolute inset-0 opacity-50" />
            <div
              className={`relative z-10 mx-auto w-full max-w-3xl text-center`}
            >
              <p
                className={`
                  text-xs font-medium tracking-[0.2em] text-primary uppercase
                `}
              >
                Join us
              </p>
              <h2
                className={`
                  font-heading mt-4 text-3xl font-bold tracking-tight
                  text-foreground
                  md:text-4xl
                `}
              >
                Ready to join the Cult?
              </h2>
              <p
                className={`
                  mt-4 text-lg text-muted-foreground
                  md:text-xl
                `}
              >
                Member discounts, early access to new drops, free shipping on
                most orders. This is more than a store — it&apos;s a community.
              </p>
              <div
                className={`
                  mt-8 flex flex-col items-center justify-center gap-4
                  sm:flex-row
                `}
              >
                <Link href="/membership">
                  <Button
                    className="h-12 px-8 text-sm tracking-wider uppercase"
                    size="lg"
                  >
                    Become a Member
                  </Button>
                </Link>
                <Link href="/products">
                  <Button
                    className="h-12 px-8 text-sm tracking-wider uppercase"
                    size="lg"
                    variant="outline"
                  >
                    Browse products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
