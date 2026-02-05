import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { AboutPageStructuredData } from "~/ui/components/structured-data";
import { Button } from "~/ui/primitives/button";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://culture.store";

export const metadata: Metadata = {
  description:
    "Culture is the lifestyle brand for the age of decentralization. Premium gear, toxin-free apparel, crypto-native since 2015. We're not going anywhere.",
  title: `About Us | ${SEO_CONFIG.name}`,
  openGraph: {
    title: `About Us | ${SEO_CONFIG.name}`,
    description:
      "Culture is the lifestyle brand for the age of decentralization. Premium gear, toxin-free apparel, crypto-native since 2015.",
    type: "website",
    images: [
      {
        url: "/lookbook/culture-brand-lifestyle-premium-apparel.jpg",
        width: 1200,
        height: 630,
        alt: "Culture brand — lifestyle and premium apparel",
      },
    ],
  },
  alternates: {
    canonical: `${siteUrl}/about`,
  },
};

export default function AboutPage() {
  return (
    <>
      <AboutPageStructuredData />
      <div className="container mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <header className="mb-12 border-b border-border pb-10">
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <Image
            src="/lookbook/culture-brand-lifestyle-premium-apparel.jpg"
            alt="Culture brand — premium apparel and lifestyle. Photos by George J. Patterson."
            title="Culture lifestyle"
            width={1200}
            height={630}
            className="h-auto w-full object-cover"
            sizes="(max-width: 896px) 100vw, 896px"
            priority
          />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          About Us
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We've been here since 2015. We're building for 2030 and beyond.
        </p>
      </header>

      <div className="space-y-10">
        {/* Origin & staying power */}
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Where it started — and where we're going
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Culture began in 2015 as a small store for the early Bitcoin
            community. We sold hardware wallets, crypto-themed apparel, and
            physical bitcoins to cypherpunks and early adopters who believed in
            a decentralized future. We've survived bear markets, exchange
            blowups, and every &quot;crypto is dead&quot; headline. We're still
            here.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Today we're a full lifestyle brand: toxin-free apparel, premium
            gear, wellness-focused products, and an AI-native store built for
            how you actually live. The products evolved. The mission didn't.
            We're not a pop-up. We're not a side project. We're building the
            commercial infrastructure for the life you actually want — and we're
            not going anywhere.
          </p>
        </section>

        {/* Where culture and technology merge — Web3 */}
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            We love Web3
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            Where culture and technology merge
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The age of decentralization isn't a trend — it's the paradigm. We
            ship worldwide, accept SOL, ETH, BTC, and 50+ coins, and we're
            building phygital drops and token-gated merch so your drip is
            verifiable on-chain. Pay with your wallet. Hold $CULT for free
            shipping, early access, and exclusive drops. Your keys, your style,
            your culture.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            No mandatory sign-up. No selling your data. We're not Shopify; we
            don't track you across the web or hand your info to advertisers.
            Your data is yours — download it, delete it, or keep it local. We
            collect what we need to ship your order. That's it.
          </p>
          <div className="mt-4">
            <Button asChild variant="secondary" size="sm">
              <Link href="/token">$CULT Token</Link>
            </Button>
          </div>
        </section>

        {/* Pure style, we care for you — health */}
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            We care for you
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            Pure style for a healthier you
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The clothes you wear and the products you touch become part of you.
            We curate apparel made from natural fibers — organic cotton, bamboo,
            alpaca — not polyester and synthetic blends that increase cancer
            risks and belong in the past. Premium coffee, clean water filters,
            red light therapy, gear that lasts. Fashionable and actually safe.
            We want you looking good and feeling better, for the long run.
          </p>
        </section>

        {/* Exquisite essentials — quality merch */}
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <div className="mb-5 overflow-hidden rounded-lg border border-border">
            <Image
              src="/lookbook/culture-lookbook-lifestyle-and-apparel.jpg"
              alt="Culture merchandise — limited edition apparel and accessories. Premium quality."
              title="Exquisite essentials"
              width={800}
              height={600}
              className="h-auto w-full object-cover"
              sizes="(max-width: 896px) 100vw, 800px"
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            We want the best for you
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            Exquisite essentials
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Our collection is a blend of quality and style. Limited tees,
            hoodies, phone cases, accessories — each piece is curated to meet
            the Culture test: Does it improve your life? Is it built to last?
            Would we use it ourselves? We don't do disposable. We do
            statement-making gear that elevates your everyday and leaves a
            lasting impression.
          </p>
          <div className="mt-4">
            <Button asChild variant="secondary" size="sm">
              <Link href="/products">Shop All Products</Link>
            </Button>
          </div>
        </section>

        {/* AI-native & community */}
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Built for the future — and for degens
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We're building AI-native commerce: order through Alice on Discord,
            Telegram, or X. Our APIs are built for agents and bots. $CULT
            holders can vote on new products and get early access to drops. We
            partner with the projects and creators that define the culture —
            from pump.fun to the next wave. If you're plugged in, you're in the
            right place.
          </p>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We ship to 100+ countries. Free shipping for members over threshold.
            Crypto or card — your choice. Questions? Hit us up. We're here for
            the long run.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/contact">Contact Us</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/policies/shipping">Shipping</Link>
            </Button>
          </div>
        </section>

        {/* Closing — we're not going anywhere */}
        <section className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-5 sm:px-6">
          <p className="text-center text-lg font-medium leading-relaxed text-foreground">
            A decade ago we sold Bitcoin tees to cypherpunks. Today we're the
            lifestyle brand for everyone who gets it: sovereignty over your
            money, your data, your health, your future. The Age of
            Decentralization is here. We're not going anywhere. Welcome to
            Culture.
          </p>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Page photography by George J. Patterson.{" "}
          <Link href="/lookbook" className="underline hover:text-foreground">
            View lookbook
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}
