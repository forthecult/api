import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "~/db";
import { productReviewsTable, productsTable } from "~/db/schema";
import { getPublicSiteUrl } from "~/lib/app-url";

/**
 * Public XML feed for product reviews (Google Merchant / Product ratings programs).
 * @see https://developers.google.com/product-review-feeds/schema
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function x(s: null | string | undefined): string {
  if (s == null || s === "") return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const site = getPublicSiteUrl().replace(/\/$/, "");
  const reviews = await db
    .select({
      author: productReviewsTable.author,
      brand: productsTable.brand,
      comment: productReviewsTable.comment,
      createdAt: productReviewsTable.createdAt,
      customerName: productReviewsTable.customerName,
      gtin: productsTable.gtin,
      id: productReviewsTable.id,
      location: productReviewsTable.location,
      mpn: productsTable.mpn,
      name: productsTable.name,
      productId: productReviewsTable.productId,
      productName: productReviewsTable.productName,
      productSlug: productReviewsTable.productSlug,
      rating: productReviewsTable.rating,
      showName: productReviewsTable.showName,
      title: productReviewsTable.title,
    })
    .from(productReviewsTable)
    .leftJoin(
      productsTable,
      and(
        isNotNull(productReviewsTable.productId),
        eq(productReviewsTable.productId, productsTable.id),
      ),
    )
    .where(eq(productReviewsTable.visible, true))
    .orderBy(desc(productReviewsTable.createdAt))
    .limit(10_000);

  const idList = [
    ...new Set(
      reviews
        .map((r) => r.productId)
        .filter((a): a is string => a != null && a.length > 0),
    ),
  ];
  const idToSlug: Record<string, string> = {};
  if (idList.length) {
    const prows = await db
      .select({ id: productsTable.id, slug: productsTable.slug })
      .from(productsTable)
      .where(inArray(productsTable.id, idList));
    for (const p of prows) {
      if (p.slug) idToSlug[p.id] = p.slug;
    }
  }

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push("<feed>");
  out.push("  <version>2.0</version>");
  for (const r of reviews) {
    const slug =
      r.productSlug?.trim() || (r.productId && idToSlug[r.productId]);
    const pUrl = slug ? `${site}/${encodeURI(slug)}` : site;
    const pName = (r.name ?? r.productName ?? "Product").trim();
    const t =
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt ?? new Date().toISOString());
    const reviewer = !r.showName
      ? "Anonymous"
      : (() => {
          const a = r.author?.trim();
          if (a) return x(a);
          const first = (r.customerName || "Customer").trim().split(/\s+/)[0];
          return x(first && first.length > 0 ? first : "Customer");
        })();
    const revTitle = r.title?.trim();
    out.push("  <review>");
    out.push(`    <review_id>${x(r.id)}</review_id>`);
    if (r.location?.trim()) {
      out.push("    <reviewer>");
      out.push(`      <name>${reviewer}</name>`);
      out.push(`      <location>${x(r.location.trim())}</location>`);
      out.push("    </reviewer>");
    } else {
      out.push(`    <reviewer><name>${reviewer}</name></reviewer>`);
    }
    out.push(`    <review_timestamp>${x(t)}</review_timestamp>`);
    if (revTitle) out.push(`    <title>${x(revTitle)}</title>`);
    out.push(`    <content>${x(r.comment)}</content>`);
    out.push(`    <review_url>${x(`${pUrl}#product-reviews`)}</review_url>`);
    out.push(
      `    <ratings><overall min="1" max="5">${r.rating}</overall></ratings>`,
    );
    out.push("    <products><product>");
    out.push(`      <product_url>${x(pUrl)}</product_url>`);
    out.push(`      <name>${x(pName)}</name>`);
    if (r.gtin?.trim()) {
      out.push(`      <gtins><gtin>${x(r.gtin.trim())}</gtin></gtins>`);
    }
    if (r.mpn?.trim()) {
      out.push(`      <mpns><mpn>${x(r.mpn.trim())}</mpn></mpns>`);
    }
    if (r.brand?.trim()) {
      out.push(`      <brand name="${x(r.brand.trim())}"/>`);
    }
    out.push("    </product></products>");
    out.push("  </review>");
  }
  out.push("  <link");
  out.push('    type="text/xml"');
  out.push(`    rel="self" href="${x(site)}/feeds/product-reviews.xml"`);
  out.push("  />");
  out.push("</feed>");

  return new Response(out.join("\n"), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
