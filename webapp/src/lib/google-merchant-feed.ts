import "server-only";
import { and, eq } from "drizzle-orm";

import { db } from "~/db";
import { productsTable, productVariantsTable } from "~/db/schema";
import { getPublicSiteUrl } from "~/lib/app-url";
import { stripHtmlForMeta } from "~/lib/sanitize-product-description";

interface FeedRow {
  brand: null | string;
  continueSelling: boolean;
  description: null | string;
  googleProductCategory: null | string;
  gtin: null | string;
  hasVariants: boolean;
  id: string;
  imageUrl: null | string;
  itemCondition: string;
  mpn: null | string;
  name: string;
  priceCents: number;
  quantity: null | number;
  slug: null | string;
  trackQuantity: boolean;
  variantGtin: null | string;
  variantId: null | string;
  variantMpn: null | string;
  variantPriceCents: null | number;
  variantSku: null | string;
  variantStock: null | number;
}

/**
 * RSS 2.0 + `g:` namespace feed aligned with Google Merchant Center product data.
 * URLs and availability mirror storefront JSON-LD (`?variant=` for multi-SKU).
 */
export async function buildGoogleMerchantFeedXml(): Promise<string> {
  const base = getPublicSiteUrl().replace(/\/$/, "");

  const rows = await db
    .select({
      brand: productsTable.brand,
      continueSelling: productsTable.continueSellingWhenOutOfStock,
      description: productsTable.description,
      googleProductCategory: productsTable.googleProductCategory,
      gtin: productsTable.gtin,
      hasVariants: productsTable.hasVariants,
      id: productsTable.id,
      imageUrl: productsTable.imageUrl,
      itemCondition: productsTable.itemCondition,
      mpn: productsTable.mpn,
      name: productsTable.name,
      priceCents: productsTable.priceCents,
      quantity: productsTable.quantity,
      slug: productsTable.slug,
      trackQuantity: productsTable.trackQuantity,
      variantGtin: productVariantsTable.gtin,
      variantId: productVariantsTable.id,
      variantMpn: productVariantsTable.mpn,
      variantPriceCents: productVariantsTable.priceCents,
      variantSku: productVariantsTable.sku,
      variantStock: productVariantsTable.stockQuantity,
    })
    .from(productsTable)
    .leftJoin(
      productVariantsTable,
      eq(productVariantsTable.productId, productsTable.id),
    )
    .where(
      and(eq(productsTable.published, true), eq(productsTable.hidden, false)),
    );

  const byProduct = new Map<
    string,
    { product: FeedRow; variants: FeedRow[] }
  >();

  for (const r of rows as FeedRow[]) {
    const existing = byProduct.get(r.id);
    if (!existing) {
      byProduct.set(r.id, {
        product: r,
        variants: r.variantId ? [r] : [],
      });
    } else if (r.variantId) {
      const dup = existing.variants.some((v) => v.variantId === r.variantId);
      if (!dup) existing.variants.push(r);
    }
  }

  const itemsXml: string[] = [];

  for (const { product: p, variants } of byProduct.values()) {
    const slug = (p.slug ?? p.id).trim().replace(/^\/+/, "");
    const linkBase = `${base}/${slug}`;
    const title = escapeXml(p.name);
    const desc = escapeXml(stripHtmlForMeta(p.description).slice(0, 5000));
    const imageRaw = p.imageUrl?.trim();
    const imageLink = imageRaw
      ? escapeXml(
          imageRaw.startsWith("http")
            ? imageRaw
            : `${base}${imageRaw.startsWith("/") ? "" : "/"}${imageRaw}`,
        )
      : "";
    const brandXml = p.brand?.trim()
      ? `<g:brand>${escapeXml(p.brand.trim())}</g:brand>`
      : "";
    const googleCatXml = p.googleProductCategory?.trim()
      ? `<g:google_product_category>${escapeXml(p.googleProductCategory.trim())}</g:google_product_category>`
      : "";
    const condition = googleCondition(p.itemCondition);

    const emitItem = (args: {
      availability: "in stock" | "out of stock";
      gtin?: null | string;
      id: string;
      link: string;
      mpn?: null | string;
      priceCents: number;
      sku: string;
    }) => {
      const price = formatPriceUsd(args.priceCents);
      const gtinXml = args.gtin?.trim()
        ? `<g:gtin>${escapeXml(args.gtin.trim())}</g:gtin>`
        : "";
      const mpnXml = args.mpn?.trim()
        ? `<g:mpn>${escapeXml(args.mpn.trim())}</g:mpn>`
        : "";
      const imgXml = imageLink
        ? `<g:image_link>${imageLink}</g:image_link>`
        : "";
      const hasIdentifier = Boolean(args.gtin?.trim() || args.mpn?.trim());
      itemsXml.push(`<item>
  <g:id>${escapeXml(args.id)}</g:id>
  <title>${title}</title>
  <description>${desc}</description>
  <g:item_group_id>${escapeXml(p.id)}</g:item_group_id>
  <link>${escapeXml(args.link)}</link>
  ${imgXml}
  ${brandXml}
  ${googleCatXml}
  <g:condition>${condition}</g:condition>
  <g:availability>${args.availability}</g:availability>
  <g:price>${price}</g:price>
  <g:identifier_exists>${hasIdentifier ? "yes" : "no"}</g:identifier_exists>
  ${gtinXml}
  ${mpnXml}
  <g:sku>${escapeXml(args.sku)}</g:sku>
</item>`);
    };

    if (variants.length > 0) {
      for (const v of variants) {
        const vid = v.variantId!;
        const priceCents = v.variantPriceCents ?? p.priceCents;
        const sku =
          v.variantSku?.trim() ||
          `${(p.slug ?? p.id).replace(/\//g, "-")}-${vid}`;
        const link = `${linkBase}?variant=${encodeURIComponent(vid)}`;
        const availability = googleAvailability({
          continueSellingWhenOutOfStock: p.continueSelling,
          trackQuantity: p.trackQuantity,
          variantStock: v.variantStock,
        });
        emitItem({
          availability,
          gtin: v.variantGtin ?? p.gtin,
          id: vid,
          link,
          mpn: v.variantMpn ?? p.mpn,
          priceCents,
          sku,
        });
      }
    } else {
      const availability = googleAvailability({
        continueSellingWhenOutOfStock: p.continueSelling,
        simpleQty: p.quantity,
        trackQuantity: p.trackQuantity,
      });
      emitItem({
        availability,
        gtin: p.gtin,
        id: p.id,
        link: linkBase,
        mpn: p.mpn,
        priceCents: p.priceCents,
        sku: p.slug?.trim() || p.id,
      });
    }
  }

  const selfUrl = `${base}/feed/google-merchant`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${escapeXml("Product feed")}</title>
    <link>${escapeXml(selfUrl)}</link>
    <description>${escapeXml("Merchant Center product data")}</description>
${itemsXml.join("\n")}
  </channel>
</rss>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPriceUsd(cents: number): string {
  const v = Math.max(0, cents) / 100;
  return `${v.toFixed(2)} USD`;
}

function googleAvailability(args: {
  continueSellingWhenOutOfStock: boolean;
  simpleQty?: null | number;
  trackQuantity: boolean;
  variantStock?: null | number;
}): "in stock" | "out of stock" {
  if (args.continueSellingWhenOutOfStock) return "in stock";
  if (args.variantStock != null) {
    return (args.variantStock ?? 0) > 0 ? "in stock" : "out of stock";
  }
  if (!args.trackQuantity) return "in stock";
  return (args.simpleQty ?? 0) > 0 ? "in stock" : "out of stock";
}

function googleCondition(raw: null | string | undefined): string {
  const c = raw?.trim().toLowerCase() ?? "new";
  if (c === "used") return "used";
  if (c === "refurbished") return "refurbished";
  return "new";
}
