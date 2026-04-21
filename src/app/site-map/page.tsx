import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/site-map`,
  },
  description: `Sitemap of ${SEO_CONFIG.name} — main pages, shop categories, and policies.`,
  title: `Sitemap | ${SEO_CONFIG.name}`,
};

const STATIC_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/featured", label: "Best Sellers" },
  { href: "/about", label: "About us" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/esim", label: "eSIM" },
  { href: "/membership", label: "Membership" },
  { href: "/telegram", label: "Telegram shop" },
  { href: "/contact", label: "Contact" },
  { href: "/track-order", label: "Track order" },
  { href: "/refund", label: "Refund requests" },
  { href: "/affiliate-program", label: "Affiliate program" },
  { href: "/services", label: "Recommended services" },
  { href: "/for-agents", label: "For AI agents" },
  { href: "/token", label: "CULT" },
  { href: "/token/stake", label: "Stake & Vote" },
  { href: "/changelog", label: "Changelog" },
  { href: "/login", label: "Log in" },
  { href: "/signup", label: "Sign up" },
  { href: "/site-map", label: "Sitemap" },
];

const POLICY_LINKS: { href: string; label: string }[] = [
  { href: "/policies/privacy", label: "Privacy policy" },
  { href: "/policies/terms", label: "Terms of use" },
  { href: "/policies/refund", label: "Refund policy" },
  { href: "/policies/shipping", label: "Shipping policy" },
  { href: "/cookies", label: "Cookies" },
];

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
}

export default async function SitemapPage() {
  const categories = await getCategories();
  const categoryLinks = categories
    .filter((c) => c.slug)
    .map((c) => ({ href: `/${c.slug}`, label: c.name }));

  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-12
        sm:px-6 sm:py-16
        lg:px-8
      `}
    >
      <header className="mb-10 border-b border-border pb-8">
        <h1
          className={`
            text-3xl font-bold tracking-tight text-foreground
            sm:text-4xl
          `}
        >
          Sitemap
        </h1>
        <p className="mt-3 text-muted-foreground">
          Main pages and sections of {SEO_CONFIG.name}. For the full list
          including all product URLs, use the{" "}
          <Link
            className={`
              font-medium text-foreground underline
              hover:no-underline
            `}
            href="/sitemap.xml"
          >
            XML sitemap
          </Link>{" "}
          (for search engines).
        </p>
      </header>

      <nav aria-label="Sitemap" className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Main pages
          </h2>
          <ul
            className={`list-inside list-disc space-y-1.5 text-muted-foreground`}
          >
            {STATIC_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  className={`
                    text-foreground underline
                    hover:no-underline
                  `}
                  href={href}
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
            <ul
              className={`
                list-inside list-disc space-y-1.5 text-muted-foreground
              `}
            >
              {categoryLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    className={`
                      text-foreground underline
                      hover:no-underline
                    `}
                    href={href}
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
          <ul
            className={`list-inside list-disc space-y-1.5 text-muted-foreground`}
          >
            {POLICY_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  className={`
                    text-foreground underline
                    hover:no-underline
                  `}
                  href={href}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`rounded-lg border border-border bg-muted/30 px-4 py-3`}
        >
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">XML sitemap:</strong>{" "}
            <Link
              className={`
                text-foreground underline
                hover:no-underline
              `}
              href="/sitemap.xml"
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

async function getCategories(): Promise<CategoryItem[]> {
  try {
    const siteUrl = getPublicSiteUrl();
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
