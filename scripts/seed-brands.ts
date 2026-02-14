/**
 * Seeds the database with curated product brands (website URL, description).
 * To add logos and assets for production: place images in scripts/brand-assets/<slug>/
 * (e.g. logo.png, banner.png), then run: bun run db:upload-brand-assets
 * (uploads to UploadThing and sets brand.logoUrl + brand_asset rows).
 * Alternatively add logos in Admin → Product Brands (upload or paste URLs).
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
  logoUrl?: string | null;
}> = [
  {
    name: "PacSafe",
    websiteUrl: "https://pacsafe.com/",
    description:
      "Anti-theft travel gear: backpacks, daypacks, crossbody bags, slings, totes, and accessories. Secure, durable designs for travelers who value safety and style.",
    featured: true,
    logoUrl:
      "https://pacsafe.com/cdn/shop/files/pacsafe_logo_backup.png",
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
  {
    name: "Trezor",
    websiteUrl: "https://trezor.io/",
    description:
      "Hardware wallets for Bitcoin and crypto. Open-source security, self-custody, and support for 1000s of coins. Trezor Safe 3, Safe 5, and Safe 7.",
    featured: true,
  },
  {
    name: "Minirig",
    websiteUrl: "https://minirigs.co.uk/",
    description:
      "Portable Bluetooth speakers and subwoofers designed and made in Bristol, UK. The loudest small speakers—Minirig 4, Mini 2, Subwoofer 4—with up to 100 hours playtime, wireless link-up, and modular sound systems.",
    featured: true,
    logoUrl: "https://files.minirigs.co.uk/mr4/minirig-4-logo-white.png",
  },
  {
    name: "Bon Charge",
    websiteUrl: "https://boncharge.com/",
    description:
      "Science-backed wellness and recovery products: red light therapy, infrared sauna blankets, PEMF devices, blue light blocking, and EMF protection. Official Red Light & Recovery Partner of Fulham FC. HSA/FSA-eligible. Free shipping on orders over $125.",
    featured: true,
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
      logoUrl: b.logoUrl ?? null,
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

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
