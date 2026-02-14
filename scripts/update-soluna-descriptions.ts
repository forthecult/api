/**
 * Update SOLUNA Printify product descriptions and features.
 * Replaces the generic SOLUNA blurbs with detailed, product-specific copy
 * based on the actual Printify blueprint specs.
 */

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocal = resolve(process.cwd(), ".env.local");
if (existsSync(envLocal)) {
  dotenvConfig({ path: envLocal, override: true });
}

const API_BASE = (
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.MAIN_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error("Set ADMIN_AI_API_KEY or ADMIN_API_KEY.");
  process.exit(1);
}

const NOTE =
  "\n\n*Note. Not to be confused with the shitcoin Solana (SOL)";

type ProductUpdate = {
  id: string;
  name: string;
  description: string;
  features: string[];
};

const products: ProductUpdate[] = [
  {
    id: "ve0RZitdCZF0lgddCW1H9",
    name: "Soluna Poker Playing Cards",
    description:
      `Deal in style with the Soluna Poker Playing Cards. Printed on smooth, 300gsm premium-coated cardstock, these cards are built for the perfect shuffle and deal every time. The Soluna logo is printed on the back of each card with a semi-glossy finish that looks sharp under any light.

Each deck includes 52 standard playing cards plus 2 Joker cards, sized at 2.5" x 3.5" (6.4cm x 8.9cm) — the regulation poker size. Packaged in a clear acrylic case for display or storage.

Whether you're hosting poker night, running a tournament, or just collecting crypto merch, this deck brings the Solana meme energy to the table.${NOTE}`,
    features: [
      "Smooth 300 gsm premium-coated cardstock paper",
      "Standard size: 2.5\" x 3.5\" (6.4cm x 8.9cm)",
      "52 playing cards + 2 Joker cards per deck",
      "Soluna logo printed on the back of each card",
      "Semi-glossy finish for easy dealing and shuffling",
      "Comes in a clear acrylic display box",
    ],
  },
  {
    id: "Na9TdAc0AVlVijxfo9QFC",
    name: "Soluna Sticker",
    description:
      `Rep Soluna anywhere with these square vinyl stickers. Made with durable 100% vinyl and a strong 3M glue backing, they stick clean and hold strong on laptops, water bottles, notebooks, phone cases — you name it.

Available in four sizes (2" × 2", 3" × 3", 4" × 4", and 6" × 6") with a glossy finish that makes the gradient Soluna logo pop. Perfect for indoor use — stick them on your setup, your gear, or trade them with the community.${NOTE}`,
    features: [
      "Made with 100% vinyl and 3M glue backing",
      "Glossy finish for vibrant color reproduction",
      "Four sizes: 2\"×2\", 3\"×3\", 4\"×4\", 6\"×6\"",
      "Grey adhesive backing for clean application",
      "Designed for indoor use",
    ],
  },
  {
    id: "1SEgE_nNHTZivtjqgwHZs",
    name: "Soluna Ping Pong Paddle",
    description:
      `Take game night to the next level with Soluna Ping Pong Balls. This set of 6 standard-size balls features the Soluna logo printed directly on each ball — perfect for beer pong, table tennis, or just flexing your crypto cred at the party.

Each ball measures 1.57" (4cm) in diameter, made from durable 100% plastic. Available in white or orange so you can match your vibe. Whether it's a tournament or a casual round, these balls are built for fun.${NOTE}`,
    features: [
      "Set of 6 custom-printed ping pong balls",
      "Standard size: 1.57\" (4cm) diameter",
      "Material: 100% durable plastic",
      "Available in white or orange",
      "Soluna logo printed on each ball",
      "Great for beer pong, table tennis, and parties",
    ],
  },
  {
    id: "jHzB7kExmjJ2uCmF-fva8",
    name: "Soluna Shot Glass",
    description:
      `Raise a glass to the Solana meme that keeps on giving. This Soluna Shot Glass is made from white ceramic with the Soluna logo printed in vivid detail. Available with a white or black interior, it's the perfect addition to your barware collection or a standout gift.

Each glass holds 1.9oz (0.056L) — just the right pour for toasting wins, milestones, or another green candle. Solid build, clean design, and compact enough to display or actually use.${NOTE}`,
    features: [
      "Material: white ceramic",
      "Capacity: 1.9oz (0.056L)",
      "Available in white or black interior",
      "Soluna logo printed in high detail",
      "Compact and sturdy for daily use or display",
    ],
  },
  {
    id: "19bQjZjjfuvxTvlLHRC4d",
    name: "Soluna Phone Case",
    description:
      `Keep your phone looking sharp with the Soluna Slim Phone Case. Made from Lexan polycarbonate plastic, this case delivers a super slim profile with serious durability. The glossy premium finish shows off the Soluna gradient logo while the impact-resistant material handles everyday drops and bumps.

Lightweight construction that doesn't add bulk. Supports wireless charging so you don't have to remove the case. Available for a wide range of iPhone models (7 through 17 series) and select Samsung Galaxy devices — check the size options for your model.${NOTE}`,
    features: [
      "Material: Lexan polycarbonate plastic",
      "Super slim design with glossy premium finish",
      "Durable and impact-resistant",
      "Supports wireless charging",
      "Available for iPhone 7 through iPhone 17 series",
      "Select Samsung Galaxy models also available",
      "Soluna gradient logo printed in high detail",
    ],
  },
  {
    id: "RjOnxUn6BnSAArv8l-tQ9",
    name: "Soluna Wireless Charger",
    description:
      `Charge up in style with the Soluna Wireless Charger. This 10W charging pad features the Soluna logo printed via high-fidelity sublimation on a 100% acrylic face plate, housed in a sleek aluminum casing. Compatible with all Qi-enabled iPhone and Android devices.

The round design measures 3.93" (10cm) in diameter and just 0.3" (0.8cm) tall — low profile enough for any desk, nightstand, or setup. Ships with a 47" (120cm) micro USB cable so you're ready to charge right out of the box. Clean design meets everyday utility.${NOTE}`,
    features: [
      "10W wireless charging power",
      "Compatible with Qi-enabled iPhone and Android devices",
      "Materials: 100% aluminum casing, 100% acrylic face plate",
      "Round design: 3.93\" (10cm) diameter, 0.3\" (0.8cm) tall",
      "High-fidelity sublimation print",
      "Includes 47\" (120cm) micro USB cable",
      "Black base color with Soluna gradient logo",
    ],
  },
];

async function main() {
  console.log("API base:", API_BASE);
  console.log(`Updating ${products.length} SOLUNA product descriptions...\n`);

  let successCount = 0;

  for (const product of products) {
    process.stdout.write(`  Updating "${product.name}"... `);

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/products/${product.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            description: product.description,
            features: product.features,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text();
        console.log(`FAILED (${res.status}: ${text.slice(0, 150)})`);
        continue;
      }

      const data = (await res.json()) as { id?: string; name?: string };
      console.log(`OK (${data.id})`);
      successCount++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`ERROR: ${msg}`);
    }
  }

  console.log(`\nDone. Updated ${successCount}/${products.length} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
