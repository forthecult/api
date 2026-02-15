/**
 * Canonical lookbook image list (metadata + static paths).
 * Used by the lookbook page and by scripts/upload-lookbook-to-uploadthing.ts
 * to migrate images to UploadThing.
 */

export interface LookbookImage {
  alt: string;
  description: string;
  size: "large" | "medium" | "small";
  src: string;
  title: string;
}

export const LOOKBOOK_IMAGES: LookbookImage[] = [
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
