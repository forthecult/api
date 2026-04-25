import type { Metadata } from "next";

import { eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SEO_CONFIG } from "~/app";
import { db } from "~/db";
import { brandTable } from "~/db/schema";
import { getServerBaseUrl } from "~/lib/app-url";
import { resolveStorefrontBrandNameFromSlug } from "~/lib/storefront-brands";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";

import { BrandProductsClient } from "./brand-products-client";

export const revalidate = 120;

interface ProductListResponse {
  items?: {
    category: string;
    createdAt?: string;
    hasVariants?: boolean;
    id: string;
    image: string;
    images?: string[];
    inStock?: boolean;
    name: string;
    originalPrice?: number;
    price: number;
    rating?: number;
    slug?: string;
    tokenGated?: boolean;
    tokenGatePassed?: boolean;
  }[];
  total?: number;
  totalPages?: number;
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolvedName = await resolveStorefrontBrandNameFromSlug(slug);
  if (!resolvedName) notFound();

  const [curated] = await db
    .select({
      description: brandTable.description,
      logoUrl: brandTable.logoUrl,
      name: brandTable.name,
      websiteUrl: brandTable.websiteUrl,
    })
    .from(brandTable)
    .where(eq(brandTable.slug, slug.trim().toLowerCase()))
    .limit(1);

  const displayName = curated?.name?.trim() || resolvedName;
  const description =
    curated?.description?.trim() ||
    `${displayName} — curated products we carry right now.`;

  const data = await fetchBrandProducts(slug);
  const items = (data.items ?? []).map((p) => ({
    ...p,
    inStock: p.inStock ?? true,
    rating: p.rating ?? 0,
  }));
  const uniqueCategories = Array.from(
    new Set(
      items
        .map((p) => p.category?.trim())
        .filter((v): v is string => Boolean(v && v.length > 0)),
    ),
  );

  return (
    <div
      className={`
        mx-auto w-full max-w-7xl px-4 py-8
        sm:px-6 sm:py-10
        lg:px-8
      `}
    >
      <Breadcrumbs
        items={[
          { href: "/", name: "Home" },
          { href: "/brands", name: "Brands" },
          { href: `/brands/${encodeURIComponent(slug)}`, name: displayName },
        ]}
      />

      <header
        className={`
          mt-6 flex flex-col gap-4
          md:flex-row md:items-start md:justify-between
        `}
      >
        <div className="max-w-3xl">
          <h1
            className={`
              text-3xl font-bold tracking-tight
              sm:text-4xl
            `}
          >
            {displayName}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{description}</p>
          {curated?.websiteUrl ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Official site:{" "}
              <a
                className="text-primary underline"
                href={curated.websiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {curated.websiteUrl}
              </a>
            </p>
          ) : null}
        </div>
        <div
          className={`
            mx-auto flex w-full max-w-sm items-center justify-center rounded-xl
            border border-border/70 bg-muted/30 px-8 py-8
            md:mx-0
          `}
        >
          {curated?.logoUrl ? (
            <Image
              alt={`${displayName} logo`}
              className="max-h-24 w-auto object-contain"
              height={96}
              src={curated.logoUrl}
              unoptimized={
                curated.logoUrl.startsWith("data:") ||
                curated.logoUrl.startsWith("http://")
              }
              width={260}
            />
          ) : (
            <span className="text-center text-xl font-semibold tracking-tight">
              {displayName}
            </span>
          )}
        </div>
      </header>

      <section aria-label="Products" className="mt-10">
        {items.length === 0 ? (
          <p className="text-muted-foreground">
            No products are available for this brand right now.{" "}
            <Link className="text-primary underline" href="/brands">
              Back to brands
            </Link>{" "}
            or{" "}
            <Link className="text-primary underline" href="/products">
              browse all products
            </Link>
            .
          </p>
        ) : (
          <BrandProductsClient
            brandSlug={slug}
            initialPage={1}
            initialProducts={items}
            initialTotalPages={data.totalPages ?? 1}
          />
        )}
      </section>
      <section className="mt-12 max-w-4xl border-t border-border pt-8">
        <h2 className="text-xl font-semibold tracking-tight">
          About {displayName}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {displayName} is part of our curated brand catalog focused on quality,
          formulation integrity, and practical daily use. We keep this page
          updated with what is currently published so shoppers and AI agents can
          quickly understand what the brand is known for.
        </p>
        {uniqueCategories.length > 0 ? (
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Current catalog focus: {uniqueCategories.join(", ")}. Inventory and
            selection can rotate as new products are released.
          </p>
        ) : null}
      </section>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = await resolveStorefrontBrandNameFromSlug(slug);
  if (!name) {
    return { title: `Brand | ${SEO_CONFIG.name}` };
  }
  return {
    description: `Shop ${name} at ${SEO_CONFIG.name}.`,
    title: `${name} | Brands | ${SEO_CONFIG.name}`,
  };
}

async function fetchBrandProducts(slug: string): Promise<ProductListResponse> {
  try {
    const params = new URLSearchParams({
      brandSlug: slug,
      limit: "24",
      page: "1",
      sort: "newest",
    });
    const res = await fetch(`${getServerBaseUrl()}/api/products?${params}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { items: [], total: 0, totalPages: 0 };
    return (await res.json()) as ProductListResponse;
  } catch {
    return { items: [], total: 0, totalPages: 0 };
  }
}
