import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getServerBaseUrl } from "~/lib/app-url";
import { Breadcrumbs } from "~/ui/components/breadcrumbs";
import { Card, CardContent } from "~/ui/primitives/card";

export const metadata: Metadata = {
  description: `Shop by brand at ${SEO_CONFIG.name}.`,
  title: `Brands | ${SEO_CONFIG.name}`,
};

interface BrandCard {
  description?: null | string;
  featured?: boolean;
  id: string;
  logo: null | string;
  name: string;
  productCount: number;
}

export default async function BrandsIndexPage() {
  const brands = await fetchBrands();
  const withProducts = brands.filter((b) => b.productCount > 0);

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
          { href: "/products", name: "Products" },
          { href: "/brands", name: "Brands" },
        ]}
      />
      <header className="mt-6 max-w-2xl">
        <h1
          className={`
            text-3xl font-bold tracking-tight
            sm:text-4xl
          `}
        >
          Brands
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Labels and partners we carry—each with its own story and catalog. Pick
          a brand to see everything we stock from them right now.
        </p>
      </header>

      {withProducts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          No brands are available yet. Browse{" "}
          <Link className="text-primary underline" href="/products">
            all products
          </Link>{" "}
          instead.
        </p>
      ) : (
        <ul
          className={`
            mt-10 grid grid-cols-1 gap-5
            sm:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {withProducts.map((b) => (
            <li key={b.id}>
              <Link
                className="block h-full"
                href={`/brands/${encodeURIComponent(b.id)}`}
              >
                <Card
                  className={`
                    h-full overflow-hidden border-border/80 transition-shadow
                    hover:shadow-md
                  `}
                >
                  <CardContent className="flex h-full flex-col gap-4 p-0">
                    <div
                      className={`
                        relative flex aspect-[16/9] items-center justify-center
                        bg-muted/40 px-6 py-8
                      `}
                    >
                      {b.logo ? (
                        <Image
                          alt=""
                          className="max-h-20 w-auto object-contain"
                          height={80}
                          src={b.logo}
                          unoptimized={
                            b.logo.startsWith("data:") ||
                            b.logo.startsWith("http://")
                          }
                          width={200}
                        />
                      ) : (
                        <span
                          className={`
                            text-center text-lg font-semibold tracking-tight
                          `}
                        >
                          {b.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 px-5 pb-5">
                      <span className="text-lg font-semibold">{b.name}</span>
                      {b.description ? (
                        <p
                          className={`
                          line-clamp-3 text-sm text-muted-foreground
                        `}
                        >
                          {b.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {b.productCount} product
                          {b.productCount === 1 ? "" : "s"} in store
                        </p>
                      )}
                      <span
                        className={`
                        mt-auto pt-2 text-sm font-medium text-primary
                      `}
                      >
                        View brand →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function fetchBrands(): Promise<BrandCard[]> {
  try {
    const res = await fetch(`${getServerBaseUrl()}/api/brands`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { brands?: BrandCard[] };
    return Array.isArray(data.brands) ? data.brands : [];
  } catch {
    return [];
  }
}
