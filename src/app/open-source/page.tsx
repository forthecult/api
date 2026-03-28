import type { Metadata } from "next";

import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { getOpenSourceLinks } from "~/lib/open-source-repos";
import { GitHubIcon } from "~/ui/components/icons/github";
import { Button } from "~/ui/primitives/button";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: { canonical: `${siteUrl}/open-source` },
  description:
    "For the Cult is built in the open. Inspect our website, AI, contracts, and app code on GitHub.",
  openGraph: {
    description:
      "Transparency builds trust. Explore our repos for the store, AI, smart contracts, and mobile.",
    title: `Open source | ${SEO_CONFIG.name}`,
    type: "website",
    url: `${siteUrl}/open-source`,
  },
  title: `Open source | ${SEO_CONFIG.name}`,
};

export default function OpenSourcePage() {
  const links = getOpenSourceLinks();
  const order = ["website", "smartContracts", "ai", "mobile"] as const;

  return (
    <div className="bg-background">
      <section
        className={`
          border-b border-border bg-gradient-to-b from-muted/40 to-background
          px-4 py-16
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-3xl text-center">
          <p
            className={`
              mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase
            `}
          >
            Transparency
          </p>
          <h1
            className={`
              font-heading text-4xl font-bold tracking-tight text-foreground
              sm:text-5xl
            `}
          >
            Open source
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We ship in public where it matters. Inspect the code, suggest fixes,
            and hold us accountable—without trusting a black box.
          </p>
        </div>
      </section>

      <section className={`
        container mx-auto max-w-4xl px-4 py-14
        sm:py-16
      `}>
        <div
          className={`
            mb-12 rounded-lg border border-border bg-card/50 p-6
            sm:p-8
          `}
        >
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Why we publish
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Privacy and commerce both require trust. Publishing source lets you
            verify what we claim—especially around AI, payments, and crypto.
            Repos may span multiple packages; we group them by surface area
            below. Swap links in your deployment via{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
              NEXT_PUBLIC_GITHUB_*
            </code>{" "}
            env vars.
          </p>
        </div>

        <ul className={`
          grid gap-6
          sm:grid-cols-2
        `}>
          {order.map((key) => {
            const item = links[key];
            return (
              <li key={key}>
                <article
                  className={`
                    flex h-full flex-col rounded-xl border border-border
                    bg-card/80 p-6 shadow-sm transition-shadow
                    hover:shadow-md
                  `}
                >
                  <h3 className={`
                    font-heading text-lg font-semibold text-foreground
                  `}>
                    {item.label}
                  </h3>
                  <p className={`
                    mt-2 flex-1 text-sm leading-relaxed text-muted-foreground
                  `}>
                    {item.description}
                  </p>
                  <Button asChild className="mt-6 gap-2" variant="outline">
                    <Link
                      href={item.href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <GitHubIcon aria-hidden className="h-4 w-4" />
                      View on GitHub
                    </Link>
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Inspired by teams who put privacy first and{" "}
          <Link
            className={`
              text-primary underline underline-offset-4
              hover:text-primary/90
            `}
            href="https://proton.me/community/open-source"
            rel="noopener noreferrer"
            target="_blank"
          >
            ship in the open
          </Link>
          — we’re building the same muscle for culture and crypto.
        </p>
      </section>
    </div>
  );
}
