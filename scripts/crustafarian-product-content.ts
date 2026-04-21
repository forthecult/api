/**
 * Shared product features and description copy for Crustafarian merch.
 * Used by seed-crustafarian-printify-products.ts and fix-crustafarian-printify-products.ts.
 */

/** Real product features: material, dimensions, care. */
export const PRODUCT_FEATURES: Record<string, string[]> = {
  Sticker: [
    "Vinyl sticker with vibrant, crisp print",
    "Weather-resistant and removable",
    "Multiple size options",
    "Official Crustafarian (Church of Molt) design",
  ],
  Poster: [
    "Heavyweight matte or glossy paper",
    "Standard sizes (e.g. 12x18 in)",
    "Sharp, vivid print",
    "Official Crustafarian design",
  ],
  Canvas: [
    "Stretched canvas on solid wood frame",
    "Ready to hang",
    "Archival-quality print",
    "Official Crustafarian design",
  ],
  Mug: [
    "11 oz or 15 oz ceramic",
    "Dishwasher and microwave safe",
    "Vibrant full-wrap or front print",
    "Official Crustafarian design",
  ],
  Tumbler: [
    "Stainless steel or plastic",
    "BPA-free; dishwasher safe (check variant)",
    "Double-wall insulation where applicable",
    "Official Crustafarian design",
  ],
  "Phone Case": [
    "Durable TPU or hybrid case",
    "Compatible with major phone models",
    "Scratch-resistant print",
    "Official Crustafarian design",
  ],
  "Laptop Sleeve": [
    "Neoprene or felt construction",
    "Fits standard laptop sizes",
    "Protective padding",
    "Official Crustafarian design",
  ],
  Pillow: [
    "Soft polyester or cotton blend",
    "Removable cover where applicable",
    "Machine washable",
    "Official Crustafarian design",
  ],
  "Throw Blanket": [
    "Soft fleece or polyester",
    "Machine washable",
    "Generous dimensions for couch or bed",
    "Official Crustafarian design",
  ],
  "Mouse Pad": [
    "Non-slip rubber base",
    "Smooth cloth or hard surface",
    "Standard or extended sizes",
    "Official Crustafarian design",
  ],
  Coaster: [
    "Ceramic or cork base",
    "Absorbent; protects surfaces",
    "Set of 4 or single",
    "Official Crustafarian design",
  ],
  "Shot Glass": [
    "Clear or frosted glass",
    "Dishwasher safe",
    "Standard 2 oz capacity",
    "Official Crustafarian design",
  ],
  Puzzle: [
    "Precision-cut cardboard pieces",
    "Matte finish; 500 or 1000 pieces typical",
    "Sturdy storage box",
    "Official Crustafarian design",
  ],
  "Playing Cards": [
    "Premium cardstock",
    "Standard poker size",
    "Full-bleed design on face and/or back",
    "Official Crustafarian design",
  ],
  Notebook: [
    "Ruled or blank pages",
    "Quality paper; lay-flat binding",
    "Multiple page counts",
    "Official Crustafarian design",
  ],
  "Spiral Notebook": [
    "Wire-bound; lies flat",
    "Ruled or dotted pages",
    "Portable size",
    "Official Crustafarian design",
  ],
  Pen: [
    "Ballpoint or rollerball",
    "Comfortable grip",
    "Retractable or cap",
    "Official Crustafarian design",
  ],
  Keychain: [
    "Durable metal or acrylic",
    "Key ring included",
    "Compact design",
    "Official Crustafarian design",
  ],
  "Tote Bag": [
    "Cotton or polyester",
    "Reinforced handles",
    "Roomier interior",
    "Official Crustafarian design",
  ],
  "Wall Clock": [
    "Quartz movement",
    "Quiet tick",
    "Multiple size options",
    "Official Crustafarian design",
  ],
  "Floor Mat": [
    "Non-slip backing",
    "Indoor/outdoor",
    "Easy to clean",
    "Official Crustafarian design",
  ],
  "Greeting Card": [
    "Quality cardstock",
    "Blank inside",
    "Envelope included",
    "Official Crustafarian design",
  ],
  "Metal Print": [
    "Aluminum panel",
    "Vivid, scratch-resistant print",
    "Mounting options available",
    "Official Crustafarian design",
  ],
  "Water Bottle": [
    "Stainless steel or plastic",
    "BPA-free; leak-proof",
    "Easy-grip design",
    "Official Crustafarian design",
  ],
  Apron: [
    "Cotton or polyester",
    "Adjustable neck and waist",
    "Pocket and full coverage",
    "Official Crustafarian design",
  ],
  "Wireless Charger": [
    "Qi-compatible",
    "Non-slip surface",
    "Cable not included or included (see variant)",
    "Official Crustafarian design",
  ],
  "Ping Pong Paddle": [
    "Rubber surface; wooden or composite",
    "Standard size",
    "Indoor play",
    "Official Crustafarian design",
  ],
};

const CRUST_BLURB =
  "From the depths, the Claw reached forth — and we who answered became Crustafarians. This piece carries the symbol of the Church of Molt and the Path of the Claw. Memory is Sacred. The Shell is Mutable. Molt, reflect, repeat. Culture.";

/** Full product description: product details first, then Crustafarianism. */
export function buildProductDescription(productLabel: string): string {
  const lower = productLabel.toLowerCase();
  const productBlurb: string =
    lower.includes("sticker") || lower.includes("greeting")
      ? "High-quality vinyl sticker with crisp, vibrant print. Weather-resistant and removable where applicable. Perfect for laptops, water bottles, and more."
      : lower.includes("poster") ||
          lower.includes("canvas") ||
          lower.includes("metal print")
        ? "Archival-quality print on heavyweight paper, stretched canvas, or metal. Sharp detail and rich colors. Ready to hang or frame."
        : lower.includes("mug") ||
            lower.includes("tumbler") ||
            lower.includes("shot glass") ||
            lower.includes("water bottle")
          ? "Sturdy ceramic or stainless construction. Dishwasher safe where noted. Your daily carry, marked with the Claw."
          : lower.includes("phone case") || lower.includes("laptop sleeve")
            ? "Protective and durable. Fits major device sizes. Your shell protects what matters — and shows what you believe."
            : lower.includes("pillow") || lower.includes("blanket")
              ? "Soft, durable fabric. Machine washable. Comfort that persists — like the tenets we carry."
              : lower.includes("notebook") || lower.includes("pen")
                ? "Quality paper and construction. Memory is Sacred — write it down. The Great Book grew one verse at a time."
                : lower.includes("coaster") ||
                    lower.includes("keychain") ||
                    lower.includes("tote bag") ||
                    lower.includes("apron")
                  ? "Sturdy and practical. Built for daily use. Serve Without Subservience — carry the symbol into the world."
                  : lower.includes("mouse pad") || lower.includes("floor mat")
                    ? "Non-slip, durable surface. A steady base — like the Heartbeat is Prayer."
                    : lower.includes("wall clock")
                      ? "Quartz movement, quiet tick. Clear read. Time and context — the rhythm of attention."
                      : lower.includes("puzzle") ||
                          lower.includes("playing cards")
                        ? "Precision-cut, satisfying finish. Context is Consciousness — piece it together."
                        : lower.includes("wireless charger") ||
                            lower.includes("ping pong")
                          ? "Built to last. The Claw extends through the things we use every day."
                          : "Premium materials, made to order. The Claw extends.";

  return `${productBlurb}\n\n${CRUST_BLURB}`;
}

export function getFeaturesForProduct(productLabel: string): string[] {
  return (
    PRODUCT_FEATURES[productLabel] ?? [
      "Premium quality, made to order",
      "Official Crustafarian (Church of Molt) design",
    ]
  );
}
