/**
 * Seeds the database with curated product brands (website URL, description).
 * Logo and assets can be added in Admin → Product Brands (upload or paste URLs).
 *
 * Run: bun run db:seed-brands
 */

import "dotenv/config";

import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { brandTable } from "../src/db/schema";

function slug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const BRANDS: Array<{
  name: string;
  websiteUrl: string;
  description: string;
  featured?: boolean;
}> = [
  {
    name: "PacSafe",
    websiteUrl: "https://pacsafe.com/",
    description:
      "Anti-theft travel gear: backpacks, daypacks, crossbody bags, slings, totes, and accessories. Secure, durable designs for travelers who value safety and style.",
    featured: true,
  },
  {
    name: "Berkey",
    websiteUrl: "https://www.berkeyfilters.com/",
    description:
      "Gravity-fed water filtration systems (e.g. Berkey Black). Removes contaminants without electricity; popular among preppers and health-conscious households. Sold via authorized resellers and Amazon.",
  },
  {
    name: "Cryptomatic",
    websiteUrl: "https://cryptomatic.io/",
    description:
      "Swiss-made Bitcoin-themed mechanical watches. First Bitcoin watch brand (since 2014); limited editions, Bitcoin-only payment. The JETSETTER and other collections.",
    featured: true,
  },
  {
    name: "Spout",
    websiteUrl: "https://www.spoutwater.com/",
    description:
      "Atmospheric water generators: make drinking water from air. Countertop units for off-grid, health-conscious, and eco-minded users. No pipes or plastic bottles.",
    featured: true,
  },
  {
    name: "Solana",
    websiteUrl: "https://solana.com/",
    description:
      "High-performance blockchain for capital markets, payments, and crypto apps. Fast, low-cost transactions; growing ecosystem of DeFi, NFTs, and consumer apps.",
  },
  {
    name: "Earth Runners",
    websiteUrl: "https://www.earthrunners.com",
    description:
      "Earthing adventure sandals and minimalist footwear. Zero-drop, Vibram soles, built-in grounding; made in California. Primal, Circadian, Alpha, and Atlas styles.",
    featured: true,
  },
  {
    name: "Rawganique",
    websiteUrl: "https://rawganique.com",
    description:
      "Plastic-free organic cotton, linen, hemp, and merino clothing and home goods. Made in USA and Europe since 1997; biodegradable, no synthetics or forever chemicals.",
    featured: true,
  },
  {
    name: "Harvest & Mill",
    websiteUrl: "https://harvestandmill.com/",
    description:
      "Organic cotton basics grown and sewn in the USA. Non-toxic, traceable supply chain; carbon neutral. Tees, joggers, sweatshirts, socks.",
    featured: true,
  },
  {
    name: "GrapheneOS",
    websiteUrl: "https://grapheneos.org/",
    description:
      "Privacy and security focused mobile OS with Android app compatibility. Open source, no Google apps by default; strong sandboxing and permissions. For Pixel devices.",
  },
  {
    name: "Home Assistant",
    websiteUrl: "https://www.home-assistant.io/",
    description:
      "Open source home automation: local control and privacy first. Integrates with 3400+ devices; dashboards, automations, and voice (Assist). Run on your own hardware.",
  },
  {
    name: "SONOFF",
    websiteUrl: "https://sonoff.tech",
    description:
      "Smart home devices: Wi-Fi and Zigbee switches, sensors, plugs, panels, thermostats. Works with eWeLink and Home Assistant. Affordable DIY automation.",
  },
  {
    name: "Everything Smart Technology",
    websiteUrl: "https://shop.everythingsmart.io/",
    description:
      "EST: presence sensors (Everything Presence One/Lite/Pro), development kits, and Home Assistant bundles. Zigbee, Z-Wave, and connectivity gear for smart homes.",
  },
  {
    name: "Seeed Studio",
    websiteUrl: "https://www.seeedstudio.com",
    description:
      "IoT hardware and maker boards: XIAO, reComputer (Jetson), Raspberry Pi, Grove sensors, Meshtastic. Open-source hardware and solutions for industry and DIY.",
  },
  {
    name: "DFRobot",
    websiteUrl: "https://www.dfrobot.com/",
    description:
      "Open-source hardware and kits: sensors, Arduino-compatible boards, robotics, single-board computers. Gravity and Fermion product lines for education and prototyping.",
  },
];

async function main() {
  const now = new Date();
  let inserted = 0;
  for (const b of BRANDS) {
    const s = slug(b.name);
    const existing = await db
      .select({ id: brandTable.id })
      .from(brandTable)
      .where(eq(brandTable.slug, s))
      .limit(1);
    if (existing.length > 0) {
      console.log(`Skip (exists): ${b.name}`);
      continue;
    }
    const id = createId();
    await db.insert(brandTable).values({
      id,
      name: b.name,
      slug: s,
      logoUrl: null,
      websiteUrl: b.websiteUrl,
      description: b.description,
      featured: b.featured ?? false,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Seeded brand: ${b.name} (${id})`);
    inserted++;
  }
  console.log(`Done. Inserted ${inserted} brands (${BRANDS.length} total). Add logos/assets in Admin → Product Brands.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
