import type { Metadata } from "next";

import { eq } from "drizzle-orm";
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
        </div>
      </header>

      <section aria-label="Products" className="mt-10">
        {items.length === 0 ? (
          <p className="text-muted-foreground">
            No products for this brand are in stock right now.{" "}
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
      forStorefront: "1",
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
