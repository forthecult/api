/**
 * Seeds the database with For the Cult categories (Shop + Shop by Crypto).
 *
 * Slugs = what people search. SEO-first: full names (bitcoin, ethereum, dogecoin, monero, uniswap)
 * not tickers (btc, eth, doge). Parent slugs: currency, network, dapps (short and clear).
 *
 * Every category has title, metaDescription, and description for SEO and category pages.
 * Copy aligned with Culture Bible (four pillars, brand voice). Run: bun run db:seed-categories
 */

import "dotenv/config";

import { db } from "../src/db";
import { categoriesTable } from "../src/db/schema";

const now = new Date();

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  metaDescription: string | null;
  description: string | null;
  level: number;
  parentId: string | null;
};

/** Shop: product-type categories. Copy aligned with Culture Bible (four pillars, natural materials, premium). */
const SHOP_CATEGORIES: CategoryRow[] = [
  {
    id: "mens-clothing",
    name: "Men's Clothing",
    slug: "mens-clothing",
    title: "Men's Clothing — Organic Cotton & Natural Fiber Apparel | Culture",
    metaDescription:
      "Men's tees, hoodies, jackets and more in organic cotton and natural fibers only. No polyester. Premium apparel that protects your health. Culture.",
    description:
      "Apparel that touches your body should protect your health. We sell men's clothing in organic cotton, bamboo, and alpaca only—no polyester, no synthetic blends. Natural fibers breathe better, last longer, and don't shed microplastics. Tees, tank tops, long sleeves, sweatshirts, hoodies, jackets, sportswear, shoes. Premium quality. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "womens-clothing",
    name: "Women's Clothing",
    slug: "womens-clothing",
    title: "Women's Clothing — Toxin-Free, Natural Fiber Apparel | Culture",
    metaDescription:
      "Women's tees, hoodies, swimwear and more in organic cotton and natural fibers. No synthetics. Premium, health-conscious apparel. Culture.",
    description:
      "The clothes you wear become part of you. We sell women's clothing in organic cotton, bamboo, and natural fibers only—no polyester or synthetic blends. Tees, crop tops, tank tops, long sleeves, sweatshirts, hoodies, jackets, sportswear, swimwear. Premium quality, toxin-free. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "childrens-clothing",
    name: "Children's Clothing",
    slug: "childrens-clothing",
    title:
      "Children's Clothing — Safe, Natural Fiber Kids & Baby Apparel | Culture",
    metaDescription:
      "Kids and baby clothing in organic cotton and natural fibers. No polyester. Safe, durable apparel for the whole family. Culture.",
    description:
      "Safe, natural materials for the whole family. Children's clothing in organic cotton and natural fibers only—no polyester or synthetics. Tees, long sleeves, hoodies, sweatshirts, baby clothing. Premium quality that lasts. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "accessories",
    name: "Accessories",
    slug: "accessories",
    title:
      "Accessories — Hardware Wallets, Hats, Bags, Tech & Travel | Culture",
    metaDescription:
      "Hardware wallets (Trezor, Ledger), hats, bags, phone cases, travel gear. Protect your assets and autonomy. Premium accessories. Culture.",
    description:
      "Tools that protect your assets and autonomy. Hardware wallets (Trezor, Ledger) for self-custody. Hats, socks, watches, bags, phone cases, mouse pads, tech and travel accessories. We curate for quality and privacy—no products that require always-on cloud or sell your data. Pay with 50+ cryptocurrencies or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "home-living",
    name: "Home & Living",
    slug: "home-living",
    title: "Home & Living — Premium Coffee, Wall Art, Mugs, Kitchen | Culture",
    metaDescription:
      "Premium coffee (mycotoxin-tested), wall art, books, mugs, towels, kitchen and bathroom. Quality home products. Culture.",
    description:
      "Products for how you live. Premium coffee (single-origin, mycotoxin-tested), dark chocolate, wall art with optional digital certificates, books, posters, mugs, glassware, towels, bathroom and kitchen accessories. We prioritize quality and health—no planned obsolescence, no harmful materials. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "smart-home",
    name: "Smart Home",
    slug: "smart-home",
    title: "Smart Home — Automation, Hubs, Sensors & Privacy-Respecting Tech | Culture",
    metaDescription:
      "Smart home devices, automation hubs, sensors, and accessories. Privacy-conscious options. Quality tech for your space. Culture.",
    description:
      "Smart home products that put you in control. Automation hubs, sensors, smart plugs, lighting, and accessories. We favor devices that work locally and respect privacy—no mandatory cloud lock-in where we can find it. Premium quality. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "ai",
    name: "AI",
    slug: "ai",
    title: "AI — Tools, Hardware & Learning | Culture",
    metaDescription:
      "AI products, tools, and hardware. Local-first and privacy-conscious options. Quality tech. Culture.",
    description:
      "AI products and tools for creators and builders. Hardware, software, and learning resources. We curate for quality and prefer options that run locally or respect your data. Premium tech. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "iot",
    name: "IOT",
    slug: "iot",
    title: "IOT — Connected Devices, Sensors & Edge Tech | Culture",
    metaDescription:
      "IOT devices, sensors, and edge tech. Connected hardware for makers and homes. Quality and durability. Culture.",
    description:
      "IOT and connected devices for home, workshop, and projects. Sensors, gateways, edge devices, and maker-friendly hardware. We curate for reliability and open standards where possible. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "other",
    name: "Other",
    slug: "other",
    title: "Staff Picks & Curated Collections — Limited Editions | Culture",
    metaDescription:
      "Staff picks, Age of Decentralization, Bitcoin Not Bombs, token-gated drops, personalizations. Curated collections. Culture.",
    description:
      "Curated collections and limited editions. Staff picks, Age of Decentralization merchandise (digitally verified when applicable), cause-based collections, partner merchandise, and personalizations. Every product meets our curation standards: meaningful quality, pillar-aligned, no harm. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
];

/** Men's Clothing subcategories. Natural fibers only (Culture pillar: Protect Your Health). */
const MENS_SUB: CategoryRow[] = [
  {
    id: "mens-tees",
    name: "Tees",
    slug: "mens-tees",
    title: "Men's Tees — Organic Cotton T-Shirts | Culture",
    metaDescription:
      "Men's t-shirts in organic cotton and natural fibers. No polyester. Premium quality. Culture.",
    description:
      "Men's t-shirts in organic cotton and natural fibers. Natural fibers breathe better and don't shed microplastics.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-tank-tops",
    name: "Tank Tops",
    slug: "mens-tank-tops",
    title: "Men's Tank Tops — Natural Fiber | Culture",
    metaDescription:
      "Men's tank tops in organic cotton and natural fibers. Premium, health-conscious. Culture.",
    description: "Men's tank tops in organic cotton and natural fibers only.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-long-sleeves",
    name: "Long Sleeves",
    slug: "mens-long-sleeves",
    title: "Men's Long Sleeves — Organic Cotton | Culture",
    metaDescription:
      "Men's long sleeve shirts in organic cotton and natural fibers. Culture.",
    description:
      "Men's long sleeve shirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-sweatshirts",
    name: "Sweatshirts",
    slug: "mens-sweatshirts",
    title: "Men's Sweatshirts — Natural Fiber | Culture",
    metaDescription:
      "Men's sweatshirts in organic cotton and natural fibers. Premium quality. Culture.",
    description: "Men's sweatshirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-hoodies",
    name: "Hoodies",
    slug: "mens-hoodies",
    title: "Men's Hoodies — Organic Cotton | Culture",
    metaDescription:
      "Men's hoodies in organic cotton and natural fibers. No polyester. Culture.",
    description: "Men's hoodies in organic cotton and natural fibers only.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-jackets-vests",
    name: "Jackets and Vests",
    slug: "mens-jackets-vests",
    title: "Men's Jackets and Vests | Culture",
    metaDescription:
      "Men's jackets and vests in natural fibers. Premium quality. Culture.",
    description:
      "Men's jackets and vests in natural fibers. Premium, built to last.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-sportswear",
    name: "Sportswear",
    slug: "mens-sportswear",
    title: "Men's Sportswear — Natural Fiber | Culture",
    metaDescription:
      "Men's sportswear in organic cotton and natural fibers. Culture.",
    description:
      "Men's sportswear in natural fibers. Performance without synthetics.",
    level: 2,
    parentId: "mens-clothing",
  },
  {
    id: "mens-shoes",
    name: "Shoes",
    slug: "mens-shoes",
    title: "Men's Shoes | Culture",
    metaDescription: "Men's shoes. Premium quality, built to last. Culture.",
    description: "Men's shoes curated for quality and durability.",
    level: 2,
    parentId: "mens-clothing",
  },
];

/** Women's Clothing subcategories. Natural fibers only (Culture pillar: Protect Your Health). */
const WOMENS_SUB: CategoryRow[] = [
  {
    id: "womens-tees",
    name: "Tees",
    slug: "womens-tees",
    title: "Women's Tees — Organic Cotton T-Shirts | Culture",
    metaDescription:
      "Women's t-shirts in organic cotton and natural fibers. No polyester. Culture.",
    description: "Women's t-shirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-crop-tops",
    name: "Crop Tops",
    slug: "womens-crop-tops",
    title: "Women's Crop Tops — Natural Fiber | Culture",
    metaDescription:
      "Women's crop tops in organic cotton and natural fibers. Culture.",
    description: "Women's crop tops in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-tank-tops",
    name: "Tank Tops",
    slug: "womens-tank-tops",
    title: "Women's Tank Tops — Organic Cotton | Culture",
    metaDescription:
      "Women's tank tops in organic cotton and natural fibers. Culture.",
    description: "Women's tank tops in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-long-sleeves",
    name: "Long Sleeves",
    slug: "womens-long-sleeves",
    title: "Women's Long Sleeves — Natural Fiber | Culture",
    metaDescription:
      "Women's long sleeves in organic cotton and natural fibers. Culture.",
    description:
      "Women's long sleeve shirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-sweatshirts",
    name: "Sweatshirts",
    slug: "womens-sweatshirts",
    title: "Women's Sweatshirts — Organic Cotton | Culture",
    metaDescription:
      "Women's sweatshirts in organic cotton and natural fibers. Culture.",
    description:
      "Women's sweatshirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-hoodies",
    name: "Hoodies",
    slug: "womens-hoodies",
    title: "Women's Hoodies — Natural Fiber | Culture",
    metaDescription:
      "Women's hoodies in organic cotton and natural fibers. Culture.",
    description: "Women's hoodies in organic cotton and natural fibers only.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-jackets-vests",
    name: "Jackets and Vests",
    slug: "womens-jackets-vests",
    title: "Women's Jackets and Vests | Culture",
    metaDescription:
      "Women's jackets and vests in natural fibers. Premium quality. Culture.",
    description:
      "Women's jackets and vests in natural fibers. Premium, built to last.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-sportswear",
    name: "Sportswear",
    slug: "womens-sportswear",
    title: "Women's Sportswear — Natural Fiber | Culture",
    metaDescription:
      "Women's sportswear in organic cotton and natural fibers. Culture.",
    description:
      "Women's sportswear in natural fibers. Performance without synthetics.",
    level: 2,
    parentId: "womens-clothing",
  },
  {
    id: "womens-swimwear",
    name: "Swimwear",
    slug: "womens-swimwear",
    title: "Women's Swimwear | Culture",
    metaDescription:
      "Women's swimwear. Premium quality, toxin-conscious. Culture.",
    description: "Women's swimwear curated for quality and safety.",
    level: 2,
    parentId: "womens-clothing",
  },
];

/** Children's Clothing subcategories. Safe, natural materials (Culture pillar: Protect Your Health). */
const CHILDRENS_SUB: CategoryRow[] = [
  {
    id: "childrens-tees",
    name: "Tees",
    slug: "childrens-tees",
    title: "Children's Tees — Organic Cotton | Culture",
    metaDescription:
      "Kids t-shirts in organic cotton and natural fibers. Safe, durable. Culture.",
    description:
      "Children's t-shirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "childrens-clothing",
  },
  {
    id: "childrens-long-sleeves",
    name: "Long Sleeves",
    slug: "childrens-long-sleeves",
    title: "Children's Long Sleeves | Culture",
    metaDescription:
      "Kids long sleeves in organic cotton and natural fibers. Culture.",
    description:
      "Children's long sleeve shirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "childrens-clothing",
  },
  {
    id: "childrens-hoodies-sweatshirts",
    name: "Hoodies & Sweatshirts",
    slug: "childrens-hoodies-sweatshirts",
    title: "Children's Hoodies & Sweatshirts | Culture",
    metaDescription:
      "Kids hoodies and sweatshirts in organic cotton and natural fibers. Culture.",
    description:
      "Children's hoodies and sweatshirts in organic cotton and natural fibers only.",
    level: 2,
    parentId: "childrens-clothing",
  },
  {
    id: "childrens-baby",
    name: "Baby Clothing",
    slug: "childrens-baby",
    title: "Baby Clothing — Safe, Natural Fiber | Culture",
    metaDescription:
      "Baby clothing in organic cotton and natural fibers. Safe for sensitive skin. Culture.",
    description:
      "Baby clothing in organic cotton and natural fibers only. Safe, toxin-free.",
    level: 2,
    parentId: "childrens-clothing",
  },
];

/** Accessories subcategories. Protect Assets (wallets), Autonomy (travel), Health (quality). */
const ACCESSORIES_SUB: CategoryRow[] = [
  {
    id: "accessories-crypto-hats",
    name: "Crypto Hats",
    slug: "hats",
    title: "Hats & Caps — Premium Quality | Culture",
    metaDescription: "Hats and caps. Premium quality, built to last. Culture.",
    description:
      "Hats and caps curated for quality. We sell only products we'd use ourselves.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-spontaneous-socks",
    name: "Spontaneous Socks",
    slug: "socks",
    title: "Socks — Natural Fiber When Possible | Culture",
    metaDescription:
      "Socks in natural fibers when available. Premium quality. Culture.",
    description:
      "Socks in natural fibers when available. Quality over quantity.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-cryptomatic-watches",
    name: "Cryptomatic Watches",
    slug: "watches",
    title: "Watches — Premium Timepieces | Culture",
    metaDescription: "Watches. Premium quality, built to last. Culture.",
    description:
      "Watches curated for quality and durability. No planned obsolescence.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-bags",
    name: "Bags",
    slug: "bags",
    title: "Bags & Backpacks — Travel, Security | Culture",
    metaDescription:
      "Bags and backpacks. Security-focused and travel-ready. Culture.",
    description:
      "Bags and backpacks for autonomy: travel, security, durability. We curate for quality and privacy.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-phone-cases",
    name: "Phone Cases",
    slug: "phone-cases",
    title: "Phone Cases — Premium, Durable | Culture",
    metaDescription: "Phone cases. Premium quality, built to last. Culture.",
    description:
      "Phone cases for everyday carry. Meticulously crafted. We avoid products that require cloud accounts or data harvesting.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-mouse-pads",
    name: "Mouse Pads",
    slug: "mouse-pads",
    title: "Mouse Pads | Culture",
    metaDescription: "Mouse pads. Premium quality. Culture.",
    description: "Mouse pads curated for quality and durability.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-hardware-wallets",
    name: "Hardware Wallets",
    slug: "hardware-wallets",
    title: "Hardware Wallets — Trezor, Ledger | Culture",
    metaDescription:
      "Hardware wallets for Bitcoin and crypto. Trezor, Ledger. Self-custody, secure storage. Culture.",
    description:
      "Protect your assets. Hardware wallets (Trezor, Ledger) give you self-custody—your keys, your coins. We've sold them since 2015. No intermediaries holding your funds. Pay with 50+ cryptocurrencies or card.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-tech",
    name: "Tech Accessories",
    slug: "tech-accessories",
    title: "Tech Accessories — Privacy-Respecting | Culture",
    metaDescription:
      "Tech accessories. No cloud lock-in, no data harvesting. Culture.",
    description:
      "Tech accessories curated for quality and privacy. We avoid products that require always-on cloud or sell your data.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-travel",
    name: "Travel Accessories",
    slug: "travel-accessories",
    title: "Travel Accessories — Location Independence | Culture",
    metaDescription: "Travel accessories. Durable, portable. Culture.",
    description:
      "Travel accessories for autonomy: eSIMs, security bags, portable gear. Location independence without compromising quality.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-stationery",
    name: "Stationery",
    slug: "stationery",
    title: "Stationery | Culture",
    metaDescription: "Stationery. Premium quality. Culture.",
    description: "Stationery curated for quality and durability.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-pets",
    name: "Pets",
    slug: "pets",
    title: "Pet Accessories | Culture",
    metaDescription:
      "Pet accessories. Premium quality, safe materials. Culture.",
    description: "Pet accessories curated for quality and safety.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-magnets",
    name: "Magnets",
    slug: "magnets",
    title: "Magnets | Culture",
    metaDescription: "Magnets. Premium quality. Culture.",
    description: "Magnets curated for quality.",
    level: 2,
    parentId: "accessories",
  },
  {
    id: "accessories-stickers",
    name: "Cryptocurrency Stickers",
    slug: "stickers",
    title: "Stickers — Crypto & Decentralization | Culture",
    metaDescription: "Stickers. Crypto, decentralization, community. Culture.",
    description:
      "Stickers for crypto and decentralization culture. Premium quality.",
    level: 2,
    parentId: "accessories",
  },
];

/** Home & Living subcategories. Protect Health (coffee, toxin-free), quality, premium. */
const HOME_LIVING_SUB: CategoryRow[] = [
  {
    id: "home-decentral-books",
    name: "Decentral Books",
    slug: "books",
    title: "Books — Decentralization, Bitcoin, Privacy | Culture",
    metaDescription:
      "Books on decentralization, Bitcoin, privacy, and intentional living. Culture.",
    description:
      "Books for the Age of Decentralization. Topics: decentralization, Bitcoin, privacy, health, autonomy. Premium quality. We curate for meaning and accuracy.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-posters",
    name: "Posters",
    slug: "posters",
    title: "Posters — Wall Art | Culture",
    metaDescription: "Posters and wall art. Premium quality. Culture.",
    description:
      "Posters and wall art curated for quality. Optional digital certificates where applicable.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-crypto-wall-art",
    name: "Crypto Wall Art",
    slug: "wall-art",
    title: "Wall Art — Digital Certificates (Phygital) | Culture",
    metaDescription:
      "Wall art with optional digital Certificate of Authenticity. Premium quality. Culture.",
    description:
      "Wall art that can be digitally verified. Each piece may include a digital Certificate of Authenticity (phygital). Premium quality, no planned obsolescence.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-games",
    name: "Games & Entertainment",
    slug: "games-and-entertainment",
    title: "Games & Entertainment | Culture",
    metaDescription: "Games and entertainment. Premium quality. Culture.",
    description:
      "Games and entertainment curated for quality and replay value.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-bathroom",
    name: "Bathroom",
    slug: "bathroom",
    title: "Bathroom — Towels, Soap, Wellness | Culture",
    metaDescription:
      "Bathroom products. Towels, soap, toxin-conscious. Culture.",
    description:
      "Bathroom products curated for quality and health. We avoid known carcinogens and endocrine disruptors.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-towels",
    name: "Towels",
    slug: "towels",
    title: "Towels — Natural Fiber | Culture",
    metaDescription: "Towels in natural fibers. Premium quality. Culture.",
    description: "Towels in natural fibers when available. Quality that lasts.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-mugs",
    name: "Mugs",
    slug: "mugs",
    title: "Mugs — Premium Ceramic | Culture",
    metaDescription: "Mugs. Premium ceramic, built to last. Culture.",
    description:
      "Mugs curated for quality and durability. Premium ceramic, no harmful glazes.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-glassware",
    name: "Glassware",
    slug: "glassware",
    title: "Glassware | Culture",
    metaDescription: "Glassware. Premium quality. Culture.",
    description: "Glassware curated for quality and safety.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-kitchen",
    name: "Kitchen Accessories",
    slug: "kitchen-accessories",
    title: "Kitchen Accessories | Culture",
    metaDescription:
      "Kitchen accessories. Premium quality, toxin-conscious. Culture.",
    description:
      "Kitchen accessories curated for quality and health. We avoid harmful materials.",
    level: 2,
    parentId: "home-living",
  },
  {
    id: "home-coffee",
    name: "Coffee",
    slug: "coffee",
    title: "Coffee — Single-Origin, Mycotoxin-Tested | Culture",
    metaDescription:
      "Premium coffee. Single-origin, mycotoxin-tested. Culture.",
    description:
      "Protect your health. We sell premium coffee: single-origin, mycotoxin-tested. No commodity-grade beans. Quality you can taste. Pay with crypto or card.",
    level: 2,
    parentId: "home-living",
  },
];

/** Other subcategories. Curated collections, pillar-aligned. */
const OTHER_SUB: CategoryRow[] = [
  {
    id: "staff-picks",
    name: "Staff Picks",
    slug: "staff-picks",
    title: "Staff Picks — Curated by Culture | Culture",
    metaDescription: "Staff picks. Products we use and recommend. Culture.",
    description:
      "Curated by our team. Every pick meets our standards: meaningful quality, pillar-aligned (health, privacy, assets, autonomy), no harm. Products we'd use ourselves.",
    level: 2,
    parentId: "other",
  },
  {
    id: "age-of-decentralization",
    name: "Age of Decentralization",
    slug: "age-of-decentralization",
    title: "Age of Decentralization — Digitally Verified | Culture",
    metaDescription:
      "Age of Decentralization. Limited editions, digital certificates. Culture.",
    description:
      "The Age of Decentralization is here. Limited merchandise that can be digitally verified. Apparel and art may include digital Certificates of Authenticity. We curate for quality and meaning.",
    level: 2,
    parentId: "other",
  },
  {
    id: "bitcoin-not-bombs",
    name: "Bitcoin Not Bombs",
    slug: "bitcoin-not-bombs",
    title: "Bitcoin Not Bombs | Culture",
    metaDescription: "Bitcoin Not Bombs. Cause-based collection. Culture.",
    description:
      "Cause-based collection. Premium quality products that support the message. We've supported self-sovereignty and peace since 2015.",
    level: 2,
    parentId: "other",
  },
  {
    id: "coingecko-merchandise",
    name: "CoinGecko Merchandise",
    slug: "coingecko-merchandise",
    title: "CoinGecko Merchandise | Culture",
    metaDescription: "CoinGecko merchandise. Premium quality. Culture.",
    description: "Partner merchandise from CoinGecko. Curated for quality.",
    level: 2,
    parentId: "other",
  },
  {
    id: "personalizations",
    name: "Personalizations",
    slug: "personalizations",
    title: "Personalizations — Custom Orders | Culture",
    metaDescription: "Personalized merchandise. Custom orders. Culture.",
    description:
      "Personalized and custom merchandise. We curate for quality—no disposable or low-quality personalization.",
    level: 2,
    parentId: "other",
  },
];

/** Shop by Crypto: browse by currency/network/dApp. Culture pillar: Protect Your Assets; we accept 50+ cryptos. Slugs: short, SEO-friendly. */
const SHOP_BY_CRYPTO: CategoryRow[] = [
  {
    id: "currency-potential",
    name: "Currency (Potential)",
    slug: "currency",
    title: "Shop by Currency — BTC, DOGE, XMR, LTC, ZEC | Culture",
    metaDescription:
      "Products by currency: Bitcoin (BTC), Dogecoin (DOGE), Monero (XMR), Litecoin (LTC), Zcash (ZEC). Pay with crypto or card. Premium quality. Culture.",
    description:
      "Browse products themed around currency-layer cryptocurrencies. We accept Bitcoin, Dogecoin, Monero, Litecoin, Zcash and 50+ others via BTCPay and EVM. Self-sovereignty isn't just for your money—it's for your entire life. Premium apparel, hardware wallets, art, and gifts. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "network-artificial-organism",
    name: "Network (Artificial Organism)",
    slug: "network",
    title: "Shop by Network — ETH, AVAX, ATOM, FIL, TON | Culture",
    metaDescription:
      "Products by network: Ethereum (ETH), Avalanche (AVAX), Cosmos (ATOM), Filecoin (FIL), Toncoin (TON). Premium quality. Pay with crypto. Culture.",
    description:
      "Browse products themed around network-layer protocols. We accept ETH, SOL, and 50+ cryptocurrencies. Premium apparel and merchandise. Every product meets our curation standards: quality, pillar-aligned, no harm. Pay with crypto or card.",
    level: 1,
    parentId: null,
  },
  {
    id: "application-token",
    name: "Application Token (dApps, DAOs)",
    slug: "dapps",
    title: "Shop by dApp — 1inch, Aave, Uniswap & More | Culture",
    metaDescription:
      "Products by dApp/DAO: 1inch, Aave, Uniswap, Decentraland, Maker, and more. Premium quality. Culture.",
    description:
      "Browse products themed around application tokens, dApps, and DAOs. Premium merchandise. We're a lifestyle brand built on decentralization principles—not just crypto merch. Pay with 50+ cryptocurrencies or card.",
    level: 1,
    parentId: null,
  },
];

/** Currency subcategories. Slugs: full names (bitcoin, dogecoin, …)—what people search. SEO > short URLs. */
const CURRENCY_SUB: CategoryRow[] = [
  {
    id: "bitcoin",
    name: "Bitcoin (BTC)",
    slug: "bitcoin",
    title: "Bitcoin Merchandise — Apparel, Hardware Wallets, Art | Culture",
    metaDescription:
      "Bitcoin apparel, Trezor, Ledger, wall art. Pay with BTC or card. We've accepted Bitcoin since 2015. Culture.",
    description:
      "Bitcoin apparel, hardware wallets (Trezor, Ledger), physical bitcoins, wall art, and gifts. We've accepted Bitcoin since 2015. Self-sovereignty for your money and your life. Premium quality, natural fibers for apparel. Pay with BTC or card.",
    level: 2,
    parentId: "currency-potential",
  },
  {
    id: "dogecoin",
    name: "Dogecoin (DOGE)",
    slug: "dogecoin",
    title: "Dogecoin Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Dogecoin apparel and merchandise. Pay with DOGE or card. Premium quality. Culture.",
    description:
      "Dogecoin (DOGE) merchandise for the community. Premium apparel and gear. Pay with DOGE or card. Culture.",
    level: 2,
    parentId: "currency-potential",
  },
  {
    id: "monero",
    name: "Monero (XMR)",
    slug: "monero",
    title: "Monero Merchandise — Privacy-First Apparel & Gear | Culture",
    metaDescription:
      "Monero apparel and merchandise. Pay with XMR or card. Privacy-respecting. Culture.",
    description:
      "Monero (XMR) merchandise for the privacy community. Premium apparel and gear. Pay with XMR or card. We respect financial privacy. Culture.",
    level: 2,
    parentId: "currency-potential",
  },
  {
    id: "litecoin",
    name: "Litecoin (LTC)",
    slug: "litecoin",
    title: "Litecoin Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Litecoin apparel and merchandise. Pay with LTC or card. Premium quality. Culture.",
    description:
      "Litecoin (LTC) merchandise for the community. Premium apparel and gear. Pay with LTC or card. Culture.",
    level: 2,
    parentId: "currency-potential",
  },
  {
    id: "zcash",
    name: "Zcash (ZEC)",
    slug: "zcash",
    title: "Zcash Merchandise — Privacy-First Apparel & Gear | Culture",
    metaDescription:
      "Zcash apparel and merchandise. Pay with ZEC or card. Privacy-respecting. Culture.",
    description:
      "Zcash (ZEC) merchandise for the privacy community. Premium apparel and gear. Pay with ZEC or card. Culture.",
    level: 2,
    parentId: "currency-potential",
  },
];

/** Network subcategories. Slugs: full names (ethereum, avalanche, …)—what people search. SEO > short URLs. */
const NETWORK_SUB: CategoryRow[] = [
  {
    id: "avalanche",
    name: "Avalanche (AVAX)",
    slug: "avalanche",
    title: "Avalanche Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Avalanche apparel and merchandise. Pay with AVAX, ETH, or card. Premium quality. Culture.",
    description:
      "Avalanche (AVAX) merchandise for the community. Premium apparel and gear. Pay with AVAX, ETH, or card. Culture.",
    level: 2,
    parentId: "network-artificial-organism",
  },
  {
    id: "cosmos",
    name: "Cosmos (ATOM)",
    slug: "cosmos",
    title: "Cosmos Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Cosmos apparel and merchandise. Pay with ATOM or card. Premium quality. Culture.",
    description:
      "Cosmos (ATOM) merchandise for the Interchain community. Premium apparel and gear. Pay with ATOM or card. Culture.",
    level: 2,
    parentId: "network-artificial-organism",
  },
  {
    id: "ethereum",
    name: "Ethereum (ETH)",
    slug: "ethereum",
    title: "Ethereum Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Ethereum apparel and merchandise. Pay with ETH or card. Premium quality. Culture.",
    description:
      "Ethereum (ETH) merchandise for the community. Premium apparel and gear. Pay with ETH or card. Culture.",
    level: 2,
    parentId: "network-artificial-organism",
  },
  {
    id: "filecoin",
    name: "Filecoin (FIL)",
    slug: "filecoin",
    title: "Filecoin Merchandise — Decentralized Storage | Culture",
    metaDescription:
      "Filecoin apparel and merchandise. Pay with FIL or card. Premium quality. Culture.",
    description:
      "Filecoin (FIL) merchandise for the decentralized storage community. Premium apparel and gear. Pay with FIL or card. Culture.",
    level: 2,
    parentId: "network-artificial-organism",
  },
  {
    id: "toncoin",
    name: "Toncoin (TON)",
    slug: "toncoin",
    title: "Toncoin Merchandise — Apparel & Gear | Culture",
    metaDescription:
      "Toncoin apparel and merchandise. Pay with TON or card. Premium quality. Culture.",
    description:
      "Toncoin (TON) merchandise for the community. Premium apparel and gear. Pay with TON or card. Culture.",
    level: 2,
    parentId: "network-artificial-organism",
  },
];

/** Application Token subcategories. Slugs: full project names people search (1inch, aave, uniswap, decentraland, …). */
const APPLICATION_SUB: CategoryRow[] = [
  {
    id: "1inch",
    name: "1inch Network (1INCH)",
    slug: "1inch",
    title: "1inch Network Merchandise — DEX Apparel & Gear | Culture",
    metaDescription:
      "1inch Network merchandise: apparel, hoodies, and gear. DEX aggregation. Pay with 1INCH, ETH, or card. Culture.",
    description:
      "Official 1inch Network (1INCH) merchandise. Apparel and gear for the DEX aggregation community. Premium quality, natural fibers when possible. Pay with 1INCH, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "aave",
    name: "Aave (AAVE)",
    slug: "aave",
    title: "Aave Merchandise — DeFi Apparel & Gear | Culture",
    metaDescription:
      "Aave merchandise: DeFi apparel and gear. Pay with AAVE, ETH, or card. Premium quality. Culture.",
    description:
      "Aave (AAVE) merchandise for the DeFi community. Premium apparel and gear. Pay with AAVE, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "compound",
    name: "Compound (COMP)",
    slug: "compound",
    title: "Compound Merchandise — DeFi Lending | Culture",
    metaDescription:
      "Compound merchandise: DeFi lending apparel and gear. Pay with COMP, ETH, or card. Culture.",
    description:
      "Compound (COMP) merchandise for the DeFi lending community. Premium apparel and gear. Pay with COMP, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "decentraland",
    name: "Decentraland (MANA)",
    slug: "decentraland",
    title: "Decentraland Merchandise — Metaverse Apparel & Gear | Culture",
    metaDescription:
      "Decentraland merchandise: metaverse apparel and gear. Pay with MANA, ETH, or card. Culture.",
    description:
      "Decentraland (MANA) merchandise for the metaverse community. Premium apparel and gear. Pay with MANA, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "maker",
    name: "Maker (MKR)",
    slug: "maker",
    title: "Maker Merchandise — DAI & DeFi | Culture",
    metaDescription:
      "Maker merchandise: DAI and DeFi apparel and gear. Pay with MKR, ETH, or card. Culture.",
    description:
      "Maker (MKR) merchandise for the DAI and DeFi community. Premium apparel and gear. Pay with MKR, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "storj",
    name: "Storj (STORJ)",
    slug: "storj",
    title: "Storj Merchandise — Decentralized Storage | Culture",
    metaDescription:
      "Storj merchandise: decentralized storage apparel and gear. Pay with STORJ, ETH, or card. Culture.",
    description:
      "Storj (STORJ) merchandise for the decentralized storage community. Premium apparel and gear. Pay with STORJ, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "sushiswap",
    name: "SushiSwap (SUSHI)",
    slug: "sushiswap",
    title: "SushiSwap Merchandise — DEX Apparel & Gear | Culture",
    metaDescription:
      "SushiSwap merchandise: DEX apparel and gear. Pay with SUSHI, ETH, or card. Culture.",
    description:
      "SushiSwap (SUSHI) merchandise for the DEX community. Premium apparel and gear. Pay with SUSHI, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "synthetix",
    name: "Synthetix (SNX)",
    slug: "synthetix",
    title: "Synthetix Merchandise — DeFi Derivatives | Culture",
    metaDescription:
      "Synthetix merchandise: DeFi derivatives apparel and gear. Pay with SNX, ETH, or card. Culture.",
    description:
      "Synthetix (SNX) merchandise for the DeFi derivatives community. Premium apparel and gear. Pay with SNX, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "the-sandbox",
    name: "The Sandbox (SAND)",
    slug: "the-sandbox",
    title: "The Sandbox Merchandise — Metaverse & Gaming | Culture",
    metaDescription:
      "The Sandbox merchandise: metaverse and gaming apparel and gear. Pay with SAND, ETH, or card. Culture.",
    description:
      "The Sandbox (SAND) merchandise for the metaverse and gaming community. Premium apparel and gear. Pay with SAND, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
  {
    id: "uniswap",
    name: "Uniswap (UNI)",
    slug: "uniswap",
    title: "Uniswap Merchandise — DEX Apparel & Gear | Culture",
    metaDescription:
      "Uniswap merchandise: DEX apparel and gear. Pay with UNI, ETH, or card. Culture.",
    description:
      "Uniswap (UNI) merchandise for the DEX community. Premium apparel and gear. Pay with UNI, ETH, or card. Culture.",
    level: 2,
    parentId: "application-token",
  },
];

const DEMO_CATEGORY: CategoryRow[] = [
  {
    id: "testing",
    name: "Testing",
    slug: "testing",
    title: "Testing | Culture",
    metaDescription: "Test products.",
    description: "For testing checkout and flows.",
    level: 1,
    parentId: null,
  },
];

const ALL_CATEGORIES: CategoryRow[] = [
  ...SHOP_CATEGORIES,
  ...MENS_SUB,
  ...WOMENS_SUB,
  ...CHILDRENS_SUB,
  ...ACCESSORIES_SUB,
  ...HOME_LIVING_SUB,
  ...OTHER_SUB,
  ...SHOP_BY_CRYPTO,
  ...CURRENCY_SUB,
  ...NETWORK_SUB,
  ...APPLICATION_SUB,
  ...DEMO_CATEGORY,
];

async function seed() {
  console.log("Seeding Culture categories…");
  for (const c of ALL_CATEGORIES) {
    await db
      .insert(categoriesTable)
      .values({
        id: c.id,
        name: c.name,
        slug: c.slug,
        title: c.title,
        metaDescription: c.metaDescription,
        description: c.description,
        level: c.level,
        parentId: c.parentId,
        featured: false,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: categoriesTable.id,
        set: {
          name: c.name,
          slug: c.slug,
          title: c.title,
          metaDescription: c.metaDescription,
          description: c.description,
          level: c.level,
          parentId: c.parentId,
          updatedAt: now,
        },
      });
  }
  console.log(`Done. ${ALL_CATEGORIES.length} categories seeded.`);
}

seed().catch((err) => {
  console.error("Seed categories failed:", err);
  process.exit(1);
});
