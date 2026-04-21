import type { Metadata } from "next";

import Image from "next/image";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { getLookbookImages } from "~/lib/get-lookbook-images";
import { PageTokenGate } from "~/ui/components/token-gate/PageTokenGate";

const PHOTOGRAPHER = {
  bio: "George is a freelance photographer residing in Syracuse, NY. He specializes in portrait, product, and lifestyle photography.",
  name: "George J. Patterson",
};

const _LOOKBOOK_IMAGES: {
  alt: string;
  description: string;
  size: "large" | "medium" | "small";
  src: string;
  title: string;
}[] = [
  {
    alt: "Culture brand lifestyle shot — premium apparel and decentralized culture",
    description:
      "Lifestyle photography for Culture brand, premium apparel and lifestyle.",
    size: "large",
    src: "/lookbook/culture-brand-lifestyle-premium-apparel.jpg",
    title: "Culture lifestyle — About",
  },
  {
    alt: "Culture apparel lookbook — natural fiber clothing",
    description: "Product and lifestyle photography for Culture apparel.",
    size: "medium",
    src: "/lookbook/culture-apparel-lookbook-natural-fiber-clothing.jpeg",
    title: "Lookbook — Apparel 1",
  },
  {
    alt: "Culture lookbook — toxin-free apparel styling",
    description: "Lifestyle shot featuring Culture premium apparel.",
    size: "medium",
    src: "/lookbook/culture-lookbook-toxin-free-apparel-styling.jpg",
    title: "Lookbook — Apparel 2",
  },
  {
    alt: "Culture merchandise lookbook — limited edition",
    description: "Limited edition Culture merchandise, lifestyle photography.",
    size: "large",
    src: "/lookbook/culture-merchandise-lookbook-limited-edition.jpg",
    title: "Lookbook — Limited edition",
  },
  {
    alt: "Culture product photography — premium gear",
    description: "Product and lifestyle shot for Culture premium gear.",
    size: "small",
    src: "/lookbook/culture-product-photography-premium-gear.jpg",
    title: "Lookbook — Premium gear",
  },
  {
    alt: "Culture apparel — portrait and product",
    description: "Portrait and product photography for Culture brand.",
    size: "small",
    src: "/lookbook/culture-apparel-portrait-and-product.jpg",
    title: "Lookbook — Portrait",
  },
  {
    alt: "Culture lookbook — lifestyle and apparel",
    description: "Lifestyle photography featuring Culture apparel.",
    size: "large",
    src: "/lookbook/culture-lookbook-lifestyle-and-apparel.jpg",
    title: "Lookbook — Lifestyle",
  },
  {
    alt: "Culture lookbook — decentralized lifestyle",
    description: "Lifestyle shot for Culture decentralized lifestyle brand.",
    size: "medium",
    src: "/lookbook/culture-lookbook-decentralized-lifestyle.jpg",
    title: "Lookbook — Decentralized lifestyle",
  },
  {
    alt: "Culture brand lookbook — premium product",
    description: "Final lookbook shot for Culture premium product.",
    size: "medium",
    src: "/lookbook/culture-brand-lookbook-premium-product.jpg",
    title: "Lookbook — Premium product",
  },
  {
    alt: "Culture apparel styling — natural fibers",
    description: "Apparel styling shot for Culture natural fiber clothing.",
    size: "small",
    src: "/lookbook/culture-apparel-styling-natural-fibers.jpg",
    title: "Lookbook — Styling",
  },
  {
    alt: "Culture lookbook — product and lifestyle",
    description: "Product and lifestyle photography for Culture.",
    size: "medium",
    src: "/lookbook/culture-lookbook-product-and-lifestyle.jpg",
    title: "Lookbook — Product and lifestyle",
  },
  {
    alt: "Culture merchandise — lifestyle photography",
    description: "Lifestyle photography for Culture merchandise.",
    size: "large",
    src: "/lookbook/culture-merchandise-lifestyle-photography.jpg",
    title: "Lookbook — Merchandise",
  },
  {
    alt: "Culture brand lookbook — editorial",
    description: "Editorial lookbook shot for Culture brand.",
    size: "medium",
    src: "/lookbook/culture-brand-lookbook-editorial.jpg",
    title: "Lookbook — Editorial",
  },
];

/** Avoid prerender at build to prevent DB connection pool exhaustion (e.g. Neon Session mode). */
export const dynamic = "force-dynamic";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/lookbook`,
  },
  description:
    "Culture lookbook: premium apparel, toxin-free clothing, and lifestyle photography. Photos by George J. Patterson, Syracuse NY.",
  openGraph: {
    description:
      "Culture lookbook: premium apparel, toxin-free clothing, and lifestyle photography. Photos by George J. Patterson.",
    images: [
      {
        alt: "Culture lookbook — product and lifestyle photography",
        height: 630,
        url: "/lookbook/culture-lookbook-product-and-lifestyle.jpg",
        width: 1200,
      },
    ],
    title: `Lookbook | ${SEO_CONFIG.name}`,
    type: "website",
  },
  title: `Lookbook | ${SEO_CONFIG.name}`,
  twitter: {
    card: "summary_large_image",
    description:
      "Culture lookbook: premium apparel, toxin-free clothing, and lifestyle photography.",
    images: ["/lookbook/culture-lookbook-product-and-lifestyle.jpg"],
    title: `Lookbook | ${SEO_CONFIG.name}`,
  },
};

export default async function LookbookPage() {
  const images = getLookbookImages();
  return (
    <PageTokenGate slug="lookbook">
      <div
        className={`
          container mx-auto max-w-7xl px-4 py-12
          sm:px-6 sm:py-16
          lg:px-8
        `}
      >
        <header className="mb-12 border-b border-border pb-10">
          <h1
            className={`
              text-3xl font-bold tracking-tight text-foreground
              sm:text-4xl
            `}
          >
            Lookbook
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Premium apparel, natural fibers, and lifestyle — how Culture looks
            in the wild.
          </p>
        </header>

        <div
          className={`
            grid grid-cols-1 gap-4
            sm:grid-cols-2 sm:gap-6
            lg:grid-cols-3
          `}
          role="list"
        >
          {images.map((img) => (
            <figure
              className={`
                relative overflow-hidden rounded-lg border border-border
                bg-muted/30
                ${
                  img.size === "large"
                    ? `
                      sm:col-span-2
                      lg:col-span-2
                    `
                    : ""
                }
                ${
                  img.size === "medium"
                    ? `
                      sm:col-span-2
                      lg:col-span-1
                    `
                    : ""
                }
              `}
              key={img.src}
            >
              <Image
                alt={img.alt}
                className="h-auto w-full object-cover"
                height={
                  img.size === "large" ? 800 : img.size === "medium" ? 600 : 500
                }
                sizes={
                  img.size === "large"
                    ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                    : img.size === "medium"
                      ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                }
                src={img.src}
                title={img.title}
                width={
                  img.size === "large"
                    ? 1200
                    : img.size === "medium"
                      ? 800
                      : 600
                }
              />
              <figcaption className="sr-only">
                {img.title}. {img.description}
              </figcaption>
            </figure>
          ))}
        </div>

        <footer className="mt-12 border-t border-border pt-8">
          <p className="text-sm font-medium text-foreground">
            Photos by {PHOTOGRAPHER.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {PHOTOGRAPHER.bio}
          </p>
        </footer>
      </div>
    </PageTokenGate>
  );
}
