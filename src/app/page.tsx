import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import { cookies } from "next/headers";
import { ArrowRight, Clock, ShoppingBag, Star, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, getServerBaseUrl } from "~/lib/app-url";
import { FeaturedProductsSection } from "~/app/FeaturedProductsSection";
import { ImageWithRetry } from "~/ui/components/image-with-retry";
import { LiveDataTicker } from "~/ui/components/live-data-ticker";
import {
  PageContainer,
  PageSection,
  SectionHeading,
  SectionHeadingBlock,
} from "~/ui/components/layout/page-container";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

const TestimonialsSection = nextDynamic(
  () =>
    import("~/ui/components/testimonials/testimonials-with-marquee").then(
      (m) => m.TestimonialsSection,
    ),
  { ssr: true, loading: () => <div className="min-h-[200px]" /> },
);

import { testimonials as mockTestimonials } from "./mocks";

// Avoid build-time SSG timeout when API/DB unreachable (e.g. Railway build)
export const dynamic = "force-dynamic";

type TestimonialItem = {
  author: { name: string; avatar?: string; handle?: string };
  text: string;
  rating?: number;
};

async function fetchReviewsForTestimonials(): Promise<TestimonialItem[]> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/reviews?limit=20`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{ id: string; comment: string; displayName: string; rating: number }>;
    };
    const items = data.items ?? [];
    if (items.length === 0) return [];
    return items.map((r) => ({
      author: { name: r.displayName },
      text: r.comment,
      rating: r.rating,
    }));
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<
  Array<{ id: string; name: string; slug?: string; productCount: number }>
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
      categories?: Array<{
        id: string;
        name: string;
        slug?: string;
        productCount?: number;
      }>;
    };
    return (data.categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      productCount: c.productCount ?? 0,
    }));
  } catch {
    return [];
  }
}

async function fetchFeaturedProducts(cookieHeader?: string): Promise<
  Array<{
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
  }>
> {
  const baseUrl = getServerBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/products?page=1&limit=8&category=__featured__&sort=manual`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
      ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        name: string;
        hasVariants?: boolean;
        image?: string;
        category?: string;
        price?: number;
        originalPrice?: number;
        inStock?: boolean;
        rating?: number;
        slug?: string;
        tokenGated?: boolean;
        tokenGatePassed?: boolean;
      }>;
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

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
  openGraph: {
    description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
    title: SEO_CONFIG.fullName,
    type: "website",
  },
  title: SEO_CONFIG.fullName,
  alternates: {
    canonical: `${siteUrl}/`,
  },
};

const featuresWhyChooseUs = [
  {
    description:
      "Free shipping on orders over $200. Fast, reliable delivery worldwide. Members get free shipping on most orders.",
    icon: <Truck className="h-6 w-6 text-primary" />,
    title: "Free shipping",
  },
  {
    description:
      "Secure encryption and you control your data. Checkout is guest-friendly—sign up optional.",
    icon: <ShoppingBag className="h-6 w-6 text-primary" />,
    title: "Pay your way",
  },
  {
    description:
      "Our support team is here for orders, returns, and questions. We respond quickly and care about your experience.",
    icon: <Clock className="h-6 w-6 text-primary" />,
    title: "Support when you need it",
  },
  {
    description:
      "Every product is curated for quality. We stand behind what we sell with a 30-day money-back guarantee.",
    icon: <Star className="h-6 w-6 text-primary" />,
    title: "Quality guarantee",
  },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [featuredProducts, shopCategories, reviewTestimonials] =
    await Promise.all([
      fetchFeaturedProducts(cookieHeader),
      fetchCategories(),
      fetchReviewsForTestimonials(),
    ]);
  const testimonials: TestimonialItem[] =
    reviewTestimonials.length > 0 ? reviewTestimonials : mockTestimonials;
  // Shop by category: only categories that have products; exclude Currency/Network/Application Token
  const EXCLUDED_SLUGS = ["currency", "network", "dapp"];
  const topLevelShop = shopCategories.filter(
    (c) =>
      c.slug &&
      c.productCount > 0 &&
      !EXCLUDED_SLUGS.includes(c.slug),
  );

  return (
    <>
      <main
        className={`
          flex min-h-screen flex-col gap-y-16
          bg-gradient-to-b from-muted/50 via-muted/25 to-background
          dark:bg-[#0A0A0A]
        `}
      >
        {/* Hero Section — Degen Premium */}
        <section className="relative overflow-hidden py-24 md:py-32 dark:bg-[#0A0A0A]">
          <div className="bg-grid-black/[0.02] absolute inset-0 bg-[length:20px_20px] dark:bg-[length:24px_24px] dark:opacity-20" />
          <PageContainer className="relative z-10">
            <div
              className={`
                grid items-center gap-10
                lg:grid-cols-2 lg:gap-12
              `}
            >
              <div className="flex flex-col justify-center space-y-6">
                <div className="space-y-4">
                  <h1
                    className={`
                      font-display text-4xl leading-tight font-bold
                      tracking-tight text-foreground
                      sm:text-5xl md:text-6xl lg:leading-[1.1]
                      dark:text-gradient-degen
                    `}
                  >
                    WHERE SMART LIVING AND
                    <br />
                    TECHNOLOGY MEET
                  </h1>
                  <p
                    className={`
                      max-w-[700px] text-lg text-muted-foreground md:text-xl
                    `}
                  >
                    Premium products for those who choose carefully.
                    Crypto-first. Privacy-focused. Quality-obsessed.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/products">
                    <Button
                      className="h-12 gap-1.5 px-8 transition-colors duration-200"
                      size="lg"
                    >
                      Shop now <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/about">
                    <Button
                      className="h-12 px-8 transition-colors duration-200"
                      size="lg"
                      variant="outline"
                    >
                      Read Manifesto
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-wrap gap-5 text-sm text-muted-foreground font-[family-name:var(--font-mono-crypto),ui-monospace,monospace]">
                  <span>₿ PAY WITH 50+ COINS • NO KYC</span>
                  <span>🔒 ZERO TRACKERS • YOUR DATA IS YOURS</span>
                  <span>↩️ 30-DAY RETURNS • 🚚 SHIPS 2–5 DAYS</span>
                </div>
              </div>
              <div
                className={`
                  relative mx-auto hidden aspect-square w-full max-w-md
                  overflow-hidden rounded-xl border border-border shadow-lg
                  dark:border-[#222] dark:shadow-[0_0_40px_rgba(153,69,255,0.15)]
                  lg:block
                `}
              >
                <div className="absolute inset-0 z-10 bg-gradient-to-tr from-primary/20 via-transparent to-transparent dark:from-[#9945FF]/20" />
                <ImageWithRetry
                  alt="For the Cult — curated tech, premium apparel, and lifestyle gear. Where smart living and technology meet."
                  title="Culture lifestyle"
                  className="object-cover"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="/lookbook/culture-brand-lifestyle-premium-apparel.jpg"
                />
              </div>
            </div>
          </PageContainer>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent dark:via-[#9945FF]/30" />
        </section>

        {/* Live Data Ticker */}
        <LiveDataTicker />

        {/* Where culture and technology merge */}
        <PageSection className="dark:bg-[#0A0A0A]">
          <PageContainer>
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <SectionHeading
                title="A lifestyle for the independent"
                subtitle="You're in the right place. We curate tech, apparel, wellness, and travel gear that fits how you live—and the future you're building. Join as a member for product discounts, free shipping for CULT members, exclusive drops, and early access to new arrivals."
              />
              <Link href="/signup">
                <Button variant="outline" size="lg">
                  Learn about membership
                </Button>
              </Link>
            </div>
          </PageContainer>
        </PageSection>

        {/* Quality that looks good and does good */}
        <PageSection background="muted" className="dark:bg-[#141414]">
          <PageContainer>
            <div className="mx-auto max-w-3xl space-y-4 text-center">
              <h2
                className={`
                  font-display text-2xl font-semibold tracking-tight
                  text-foreground md:text-3xl
                `}
              >
                Quality that looks good and does good
              </h2>
              <p className="text-muted-foreground md:text-lg">
                What you wear and use should look great and support how you feel.
                We focus on quality materials and thoughtfully curated
                apparel—gear we'd use ourselves, for a lifestyle you can feel
                good about.
              </p>
              <Link href="/lookbook">
                <Button variant="secondary" size="lg">
                  View lookbook
                </Button>
              </Link>
            </div>
            <div className="mx-auto mt-10 max-w-4xl">
              <Link
                href="/lookbook"
                className="block overflow-hidden rounded-xl border border-border shadow-md transition hover:opacity-95"
              >
                <Image
                  src="/lookbook/culture-lookbook-lifestyle-and-apparel.jpg"
                  alt="Culture lookbook — premium apparel and lifestyle photography. Photos by George J. Patterson."
                  title="Culture lookbook"
                  width={900}
                  height={600}
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 896px) 100vw, 900px"
                />
              </Link>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Photos by George J. Patterson
              </p>
            </div>
          </PageContainer>
        </PageSection>

        {/* Curated collections */}
        <PageSection className="dark:bg-[#0A0A0A]">
          <PageContainer>
            <SectionHeading
              title="Tech, style, and everyday essentials"
              subtitle="From travel tech and premium apparel to wellness and lifestyle gear—each piece is chosen for quality and how you actually live. Functional, refined, and built to last."
            />
          </PageContainer>
        </PageSection>

        {/* Featured Categories */}
        <PageSection className="dark:bg-[#0A0A0A]">
          <PageContainer>
            <SectionHeadingBlock
              title="Shop by pillar"
              description="Browse curated tech, apparel, wellness, and travel essentials—each category handpicked for quality and value"
            />
            <div
              className={`
                grid grid-cols-2 gap-4
                md:grid-cols-3 lg:grid-cols-6 md:gap-6
              `}
            >
              {topLevelShop.length > 0 ? (
                topLevelShop.map((category) => (
                  <Link
                    aria-label={`Browse ${category.name} products`}
                    className={`
                      group flex flex-col rounded-2xl border bg-card
                      p-5 shadow transition-all duration-300
                      hover:shadow-lg hover:border-primary/30
                      dark:bg-[#141414] dark:border-[#222]
                      dark:hover:border-[#9945FF]/50 dark:hover:shadow-[0_0_20px_rgba(153,69,255,0.15)]
                    `}
                    href={`/${category.slug ?? category.id}`}
                    key={category.id}
                  >
                    <div className="mb-2 text-lg font-medium">
                      {category.name}
                    </div>
                    <p className="text-sm text-muted-foreground font-[family-name:var(--font-mono-crypto),ui-monospace,monospace]">
                      {category.productCount} products
                    </p>
                  </Link>
                ))
              ) : (
                <Link
                  className="rounded-2xl border bg-card p-5 shadow hover:border-primary/30"
                  href="/products"
                >
                  <div className="text-lg font-medium">All Products</div>
                  <p className="text-sm text-muted-foreground">
                    Browse the store
                  </p>
                </Link>
              )}
            </div>
          </PageContainer>
        </PageSection>

        {/* Featured Products */}
        <section
          className={`
            bg-muted/50 py-12 dark:bg-[#141414]
            md:py-16
          `}
        >
          <div
            className={`
              container mx-auto max-w-7xl px-4
              sm:px-6
              lg:px-8
            `}
          >
            <div className="mb-8 flex flex-col items-center text-center">
              <h2
                className={`
                  font-display text-3xl leading-tight font-bold tracking-tight
                  md:text-4xl dark:text-gradient-degen
                `}
              >
                Featured Products
              </h2>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary dark:bg-gradient-to-r dark:from-[#9945FF] dark:to-[#14F195]" />
              <p className="mt-4 max-w-2xl text-center text-muted-foreground">
                Handpicked tech, apparel, wellness, and travel gear for how you
                live
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
            <div className="mt-10 flex justify-center">
              <Link href="/products">
                <Button className="group h-12 px-8" size="lg" variant="outline">
                  View All Products
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

        {/* Features Section — Why Choose Us */}
        <section
          className={`
            py-12 dark:bg-[#0A0A0A]
            md:py-16
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
            <div className="mb-8 flex flex-col items-center text-center">
              <h2
                className={`
                  font-display text-3xl leading-tight font-bold tracking-tight
                  md:text-4xl dark:text-gradient-degen
                `}
              >
                Why Choose Us
              </h2>
              <div className="mt-2 h-1 w-12 rounded-full bg-primary dark:bg-gradient-to-r dark:from-[#9945FF] dark:to-[#14F195]" />
              <p
                className={`
                  mt-4 max-w-2xl text-center text-muted-foreground
                  md:text-lg
                `}
              >
                Secure checkout, crypto or card, free shipping over $200, and
                support when you need it
              </p>
            </div>
            <div
              className={`
                grid gap-8
                md:grid-cols-2
                lg:grid-cols-4
              `}
            >
              {featuresWhyChooseUs.map((feature) => (
                <Card
                  className={`
                    rounded-2xl border-none bg-background shadow transition-all
                    duration-300 hover:shadow-lg
                    dark:bg-[#141414] dark:border dark:border-[#222]
                    dark:hover:border-[#9945FF]/40 dark:hover:shadow-[0_0_24px_rgba(153,69,255,0.1)]
                  `}
                  key={feature.title}
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`
                        mb-3 flex h-12 w-12 items-center justify-center
                        rounded-full bg-primary/10 dark:bg-[#9945FF]/20
                        dark:text-[#14F195]
                      `}
                    >
                      {feature.icon}
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section
          className={`
            bg-muted/50 py-12 dark:bg-[#141414]
            md:py-16
          `}
        >
          <div
            className={`
              container mx-auto max-w-7xl px-4
              sm:px-6
              lg:px-8
            `}
          >
            <TestimonialsSection
              className="py-0"
              description="Don't just take our word for it—hear from people who live the Culture lifestyle"
              testimonials={testimonials}
              title="What our customers say"
            />
          </div>
        </section>

        {/* CTA Section */}
        <section
          className={`
            py-12 dark:bg-[#0A0A0A]
            md:py-16
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
                relative overflow-hidden rounded-xl border border-border
                bg-primary/10 p-8 shadow-lg dark:bg-[#141414] dark:border-[#222]
                dark:shadow-[0_0_40px_rgba(153,69,255,0.1)]
                md:p-12
              `}
            >
              <div className="bg-grid-white/[0.05] absolute inset-0 bg-[length:16px_16px] dark:opacity-30" />
              <div className="relative z-10 mx-auto max-w-2xl text-center">
                <h2
                  className={`
                    font-display text-3xl leading-tight font-bold tracking-tight
                    md:text-4xl dark:text-gradient-degen
                  `}
                >
                  Ready to live the Culture lifestyle?
                </h2>
                <p
                  className={`
                    mt-4 text-lg text-muted-foreground
                    md:text-xl
                  `}
                >
                  Join for member discounts, early access to new arrivals, and
                  free shipping over $200. Sign
                  up today.
                </p>
                <div
                  className={`
                    mt-6 flex flex-col items-center justify-center gap-3
                    sm:flex-row
                  `}
                >
                  <Link href="/signup">
                    <Button
                      className="h-12 px-8 transition-colors duration-200"
                      size="lg"
                    >
                      Sign up now
                    </Button>
                  </Link>
                  <Link href="/products">
                    <Button
                      className="h-12 px-8 transition-colors duration-200"
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
      </main>
    </>
  );
}
