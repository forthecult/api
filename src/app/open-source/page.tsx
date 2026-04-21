import type { Metadata } from "next";

import {
  GitBranch,
  Globe2,
  Link2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { cn } from "~/lib/cn";
import {
  getOpenSourceLinks,
  type OpenSourceArea,
} from "~/lib/open-source-repos";
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

const ICONS: Record<
  OpenSourceArea,
  { className: string; Icon: typeof Globe2 }
> = {
  ai: {
    className:
      "bg-gradient-to-br from-fuchsia-500 via-violet-600 to-indigo-600",
    Icon: Sparkles,
  },
  mobile: {
    className: "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700",
    Icon: Smartphone,
  },
  smartContracts: {
    className: "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600",
    Icon: Link2,
  },
  website: {
    className: "bg-gradient-to-br from-violet-500 via-purple-600 to-blue-700",
    Icon: Globe2,
  },
};

export default function OpenSourcePage() {
  const links = getOpenSourceLinks();
  const order = ["website", "smartContracts", "ai", "mobile"] as const;

  return (
    <div className="bg-background">
      <section
        className={cn(
          "border-b border-border bg-gradient-to-b from-muted/40 to-background",
          `
            py-16
            sm:py-20
          `,
        )}
      >
        <div
          className={`
            container mx-auto max-w-7xl px-4 text-center
            sm:px-6
            lg:px-8
          `}
        >
          <p
            className={`
              mb-3 text-xs font-semibold tracking-[0.2em] text-primary uppercase
            `}
          >
            Transparency
          </p>
          <h1
            className={cn(
              "font-heading text-4xl font-bold tracking-tight text-foreground",
              "sm:text-5xl",
            )}
          >
            Open source
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We ship in public where it matters. Inspect the code, suggest fixes,
            and hold us accountable—without trusting a black box.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Commerce and community both require trust. Publishing source is how
            we earn it: you can diff our claims against the implementation, file
            issues when something drifts, and contribute improvements the same
            way you would any other project you rely on.
          </p>
        </div>
      </section>

      <section
        className={`
          container mx-auto max-w-7xl px-4 py-14
          sm:px-6 sm:py-16
          lg:px-8
        `}
      >
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
          <p className="mt-3 leading-relaxed text-muted-foreground">
            This is not a stunt—open repositories are how we invite review from
            security researchers, partners, and customers who want receipts.
            When you find a bug, open a PR or a ticket; we triage security
            issues separately from feature work.
          </p>
        </div>

        <ul
          className={`
            grid gap-6
            sm:grid-cols-2
          `}
        >
          {order.map((key) => {
            const item = links[key];
            const { className: iconWrap, Icon } = ICONS[key];
            return (
              <li key={key}>
                <article
                  className={cn(
                    `
                      flex h-full flex-col rounded-xl border border-border
                      bg-card/80
                    `,
                    `p-6`,
                  )}
                >
                  <div className="flex gap-4">
                    <div
                      aria-hidden
                      className={cn(
                        `
                          flex h-12 w-12 shrink-0 items-center justify-center
                          rounded-xl text-white
                        `,
                        iconWrap,
                      )}
                    >
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className={`
                          font-heading text-lg font-semibold text-foreground
                        `}
                      >
                        {item.label}
                      </h3>
                      <p
                        className={`
                          mt-1 text-sm leading-relaxed text-muted-foreground
                        `}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`
                      mt-4 text-sm leading-relaxed text-muted-foreground
                    `}
                  >
                    {item.extended}
                  </p>
                  <ul
                    className={`
                      mt-4 list-disc space-y-1.5 pl-5 text-sm
                      text-muted-foreground
                    `}
                  >
                    {item.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
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

        <div
          className={`
            mt-14 grid gap-6
            md:grid-cols-2
          `}
        >
          <div className="rounded-xl border border-border bg-muted/20 p-6">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <ShieldCheck aria-hidden className="h-5 w-5" />
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Verify, don’t trust
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Clone the repo, run the build, and compare network behavior to
              what you see in production. If something is unclear, open a
              discussion or issue—we would rather fix the docs than leave
              ambiguity in place.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-6">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <GitBranch aria-hidden className="h-5 w-5" />
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Contribute
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We welcome focused PRs: docs, tests, accessibility, and
              performance wins all count. For larger changes, open an issue
              first so we can align on scope and avoid duplicate work.
            </p>
          </div>
        </div>

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
