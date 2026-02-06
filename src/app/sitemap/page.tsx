import Link from "next/link";

import { SEO_CONFIG } from "~/app";

export const metadata = {
  description: `Sitemap of ${SEO_CONFIG.name} — main pages, shop categories, and policies.`,
  title: `Sitemap | ${SEO_CONFIG.name}`,
};

const STATIC_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "All products" },
  { href: "/about", label: "About us" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/token", label: "$CULT Token" },
  { href: "/affiliate-program", label: "Affiliate program" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Track order" },
  { href: "/refund", label: "Refund requests" },
];

const POLICY_LINKS: { href: string; label: string }[] = [
  { href: "/policies/privacy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms of use" },
  { href: "/policies/refund", label: "Refund policy" },
  { href: "/policies/shipping", label: "Shipping policy" },
  { href: "/cookies", label: "Cookies" },
];

type CategoryItem = { id: string; slug?: string; name: string };

async function getCategories(): Promise<CategoryItem[]> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "https://forthecult.store";
    const siteUrl = /^https?:\/\//i.test(base.trim())
      ? base.trim()
      : `https://${base.trim().replace(/^\/+/, "")}`;
    const res = await fetch(`${siteUrl}/api/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { categories?: CategoryItem[] };
    return data.categories ?? [];
  } catch {
    return [];
  }
}

export default async function SitemapPage() {
  const categories = await getCategories();
  const categoryLinks = categories
    .filter((c) => c.slug)
    .map((c) => ({ href: `/${c.slug}`, label: c.name }));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Sitemap
        </h1>
        <p className="mt-3 text-muted-foreground">
          Main pages and sections of {SEO_CONFIG.name}. For the full list
          including all product URLs, use the{" "}
          <Link
            href="/sitemap.xml"
            className="font-medium text-foreground underline hover:no-underline"
          >
            XML sitemap
          </Link>{" "}
          (for search engines).
        </p>
      </header>

      <nav className="space-y-8" aria-label="Sitemap">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Main pages
          </h2>
          <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
            {STATIC_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-foreground underline hover:no-underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {categoryLinks.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Shop by category
            </h2>
            <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
              {categoryLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-foreground underline hover:no-underline"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Policies &amp; legal
          </h2>
          <ul className="list-inside list-disc space-y-1.5 text-muted-foreground">
            {POLICY_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-foreground underline hover:no-underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">XML sitemap:</strong>{" "}
            <Link
              href="/sitemap.xml"
              className="text-foreground underline hover:no-underline"
            >
              /sitemap.xml
            </Link>{" "}
            — full list of URLs for crawlers and indexing.
          </p>
        </section>
      </nav>
    </div>
  );
}
