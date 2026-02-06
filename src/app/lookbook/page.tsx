import type { Metadata } from "next";
import Image from "next/image";

import { SEO_CONFIG } from "~/app";
import { getLookbookImages } from "~/lib/get-lookbook-images";
import { TokenGateGuard } from "~/ui/components/token-gate/TokenGateGuard";

const PHOTOGRAPHER = {
  name: "George J. Patterson",
  bio: "George is a freelance photographer residing in Syracuse, NY. He specializes in portrait, product, and lifestyle photography.",
};

const LOOKBOOK_IMAGES: Array<{
  src: string;
  alt: string;
  title: string;
  description: string;
  size: "large" | "medium" | "small";
}> = [
  {
    src: "/lookbook/culture-brand-lifestyle-premium-apparel.jpg",
    alt: "Culture brand lifestyle shot — premium apparel and decentralized culture",
    title: "Culture lifestyle — About",
    description:
      "Lifestyle photography for Culture brand, premium apparel and lifestyle.",
    size: "large",
  },
  {
    src: "/lookbook/culture-apparel-lookbook-natural-fiber-clothing.jpeg",
    alt: "Culture apparel lookbook — natural fiber clothing",
    title: "Lookbook — Apparel 1",
    description: "Product and lifestyle photography for Culture apparel.",
    size: "medium",
  },
  {
    src: "/lookbook/culture-lookbook-toxin-free-apparel-styling.jpg",
    alt: "Culture lookbook — toxin-free apparel styling",
    title: "Lookbook — Apparel 2",
    description: "Lifestyle shot featuring Culture premium apparel.",
    size: "medium",
  },
  {
    src: "/lookbook/culture-merchandise-lookbook-limited-edition.jpg",
    alt: "Culture merchandise lookbook — limited edition",
    title: "Lookbook — Limited edition",
    description: "Limited edition Culture merchandise, lifestyle photography.",
    size: "large",
  },
  {
    src: "/lookbook/culture-product-photography-premium-gear.jpg",
    alt: "Culture product photography — premium gear",
    title: "Lookbook — Premium gear",
    description: "Product and lifestyle shot for Culture premium gear.",
    size: "small",
  },
  {
    src: "/lookbook/culture-apparel-portrait-and-product.jpg",
    alt: "Culture apparel — portrait and product",
    title: "Lookbook — Portrait",
    description: "Portrait and product photography for Culture brand.",
    size: "small",
  },
  {
    src: "/lookbook/culture-lookbook-lifestyle-and-apparel.jpg",
    alt: "Culture lookbook — lifestyle and apparel",
    title: "Lookbook — Lifestyle",
    description: "Lifestyle photography featuring Culture apparel.",
    size: "large",
  },
  {
    src: "/lookbook/culture-lookbook-decentralized-lifestyle.jpg",
    alt: "Culture lookbook — decentralized lifestyle",
    title: "Lookbook — Decentralized lifestyle",
    description: "Lifestyle shot for Culture decentralized lifestyle brand.",
    size: "medium",
  },
  {
    src: "/lookbook/culture-brand-lookbook-premium-product.jpg",
    alt: "Culture brand lookbook — premium product",
    title: "Lookbook — Premium product",
    description: "Final lookbook shot for Culture premium product.",
    size: "medium",
  },
  {
    src: "/lookbook/culture-apparel-styling-natural-fibers.jpg",
    alt: "Culture apparel styling — natural fibers",
    title: "Lookbook — Styling",
    description: "Apparel styling shot for Culture natural fiber clothing.",
    size: "small",
  },
  {
    src: "/lookbook/culture-lookbook-product-and-lifestyle.jpg",
    alt: "Culture lookbook — product and lifestyle",
    title: "Lookbook — Product and lifestyle",
    description: "Product and lifestyle photography for Culture.",
    size: "medium",
  },
  {
    src: "/lookbook/culture-merchandise-lifestyle-photography.jpg",
    alt: "Culture merchandise — lifestyle photography",
    title: "Lookbook — Merchandise",
    description: "Lifestyle photography for Culture merchandise.",
    size: "large",
  },
  {
    src: "/lookbook/culture-brand-lookbook-editorial.jpg",
    alt: "Culture brand lookbook — editorial",
    title: "Lookbook — Editorial",
    description: "Editorial lookbook shot for Culture brand.",
    size: "medium",
  },
];

export const metadata: Metadata = {
  title: `Lookbook | ${SEO_CONFIG.name}`,
  description:
    "Culture lookbook: premium apparel, toxin-free clothing, and lifestyle photography. Photos by George J. Patterson, Syracuse NY.",
  openGraph: {
    title: `Lookbook | ${SEO_CONFIG.name}`,
    description:
      "Culture lookbook: premium apparel, toxin-free clothing, and lifestyle photography. Photos by George J. Patterson.",
    type: "website",
  },
};

export default async function LookbookPage() {
  const images = getLookbookImages();
  return (
    <TokenGateGuard resourceType="page" resourceId="lookbook">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <header className="mb-12 border-b border-border pb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Lookbook
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Premium apparel, natural fibers, and lifestyle — how Culture looks in
          the wild.
        </p>
      </header>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
        role="list"
      >
        {images.map((img) => (
          <figure
            key={img.src}
            className={`
              relative overflow-hidden rounded-lg border border-border bg-muted/30
              ${img.size === "large" ? "sm:col-span-2 lg:col-span-2" : ""}
              ${img.size === "medium" ? "sm:col-span-2 lg:col-span-1" : ""}
            `}
          >
            <Image
              src={img.src}
              alt={img.alt}
              title={img.title}
              width={
                img.size === "large" ? 1200 : img.size === "medium" ? 800 : 600
              }
              height={
                img.size === "large" ? 800 : img.size === "medium" ? 600 : 500
              }
              className="h-auto w-full object-cover"
              sizes={
                img.size === "large"
                  ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                  : img.size === "medium"
                    ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
        <p className="mt-1 text-sm text-muted-foreground">{PHOTOGRAPHER.bio}</p>
      </footer>
    </div>
    </TokenGateGuard>
  );
}
