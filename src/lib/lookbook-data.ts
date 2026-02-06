/**
 * Canonical lookbook image list (metadata + static paths).
 * Used by the lookbook page and by scripts/upload-lookbook-to-uploadthing.ts
 * to migrate images to UploadThing.
 */

export type LookbookImage = {
  src: string;
  alt: string;
  title: string;
  description: string;
  size: "large" | "medium" | "small";
};

export const LOOKBOOK_IMAGES: LookbookImage[] = [
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
