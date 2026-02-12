import type { Metadata } from "next";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { Button } from "~/ui/primitives/button";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  title: `Changelog | ${SEO_CONFIG.name}`,
  description:
    "Follow along as we build the future of web3 commerce. Every feature, improvement, and milestone — documented.",
  openGraph: {
    title: `Changelog | ${SEO_CONFIG.name}`,
    description:
      "Follow along as we build the future of web3 commerce. Every feature, improvement, and milestone — documented.",
    type: "website",
  },
  alternates: {
    canonical: `${siteUrl}/changelog`,
  },
};

/* ------------------------------------------------------------------ */
/*  Changelog data                                                     */
/* ------------------------------------------------------------------ */

type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  items: Array<{
    /** "added" = new feature, "improved" = enhancement, "fixed" = bug fix, "coming" = unreleased */
    type: "added" | "improved" | "fixed" | "coming";
    text: string;
  }>;
};

const changelog: ChangelogEntry[] = [
  {
    version: "0.9",
    date: "February 10, 2026",
    title: "Token holder features & store optimization",
    items: [
      {
        type: "added",
        text: "Store statistics dashboard for CULT token holders with real-time sales and product analytics",
      },
      {
        type: "added",
        text: "Staking and voting interface for CULT token holders to participate in governance",
      },
      {
        type: "improved",
        text: "Curated and added high-quality products across all categories with SEO-optimized listings",
      },
      {
        type: "improved",
        text: "Full product catalog optimization — descriptions, images, tags, and meta data for every listing",
      },
      {
        type: "improved",
        text: "Organized product categories with a redesigned mega menu for faster navigation",
      },
      {
        type: "improved",
        text: "Populated XML sitemap for improved search engine indexing",
      },
    ],
  },
  {
    version: "0.8",
    date: "February 8, 2026",
    title: "Categories, notifications & security",
    items: [
      {
        type: "added",
        text: "Product category system with parent/child hierarchy and SEO-optimized category pages",
      },
      {
        type: "added",
        text: "Email and web push notifications with per-user customization preferences",
      },
      {
        type: "added",
        text: "BTCPay Server integration for Bitcoin, Dogecoin, and Monero payments",
      },
      {
        type: "improved",
        text: "Comprehensive security audit of all API endpoints and checkout flows",
      },
    ],
  },
  {
    version: "0.7",
    date: "February 7, 2026",
    title: "Telegram integration & EVM support",
    items: [
      {
        type: "added",
        text: "Telegram web app for browsing and purchasing directly inside Telegram",
      },
      {
        type: "added",
        text: "Telegram authentication and real-time order notifications via Telegram bot",
      },
      {
        type: "added",
        text: "EVM wallet authentication — connect with MetaMask, WalletConnect, and other Ethereum wallets",
      },
      {
        type: "added",
        text: "EVM payment methods for Ethereum-based transactions at checkout",
      },
    ],
  },
  {
    version: "0.6",
    date: "February 6, 2026",
    title: "Customer support & agentic commerce",
    items: [
      {
        type: "added",
        text: "Custom live chat support widget with planned AI assistant integration",
      },
      {
        type: "added",
        text: "Contact page with authenticated ticketing system for customer support",
      },
      {
        type: "added",
        text: "Discount codes and coupon functionality at checkout",
      },
      {
        type: "improved",
        text: "Extended public API for agentic commerce — enabling AI agents and bots to browse, search, and transact",
      },
    ],
  },
  {
    version: "0.5",
    date: "February 5, 2026",
    title: "Order management & affiliate program",
    items: [
      {
        type: "added",
        text: "Order tracking page with real-time shipment status and carrier integration",
      },
      {
        type: "added",
        text: "Self-service refund request page for streamlined returns",
      },
      {
        type: "added",
        text: "Affiliate program with unique referral links, tracking, and commission payouts",
      },
    ],
  },
  {
    version: "0.4",
    date: "February 4, 2026",
    title: "Security, token gating & shipping",
    items: [
      {
        type: "added",
        text: "U2F / hardware key authentication for enhanced account security",
      },
      {
        type: "added",
        text: "SPL token gating on product and category pages — restrict access based on Solana token holdings",
      },
      {
        type: "added",
        text: "Shipping calculator with real-time rate estimates by destination",
      },
    ],
  },
  {
    version: "0.3",
    date: "February 3, 2026",
    title: "Web3 identity & community features",
    items: [
      {
        type: "added",
        text: "Public REST API for developers, AI agents, and third-party integrations",
      },
      {
        type: "added",
        text: "Solana wallet authentication and account creation — shop without an email address",
      },
      {
        type: "added",
        text: "Wishlist functionality for saving and sharing favorite products",
      },
      {
        type: "added",
        text: "Product reviews system with imported customer reviews from our original store",
      },
    ],
  },
  {
    version: "0.2",
    date: "February 2, 2026",
    title: "Payment infrastructure & global reach",
    items: [
      {
        type: "added",
        text: "Stripe payment integration for credit and debit card checkout",
      },
      {
        type: "added",
        text: "Address autocomplete and validation for faster, error-free checkout",
      },
      {
        type: "added",
        text: "Support for 100+ countries and multiple fiat currencies with localized pricing",
      },
    ],
  },
  {
    version: "0.1",
    date: "February 1, 2026",
    title: "Foundation",
    items: [
      {
        type: "added",
        text: "Forked and customized the Relivator Next.js 15 template as the store foundation",
      },
      {
        type: "added",
        text: "Built the admin dashboard for product, order, and inventory management",
      },
      {
        type: "added",
        text: "Integrated Solana Pay for SOL and USDC payments at checkout",
      },
      {
        type: "added",
        text: "Live crypto pricing widget with real-time conversion rates",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Badge colors by entry type                                         */
/* ------------------------------------------------------------------ */

const BADGE_STYLES: Record<
  ChangelogEntry["items"][number]["type"],
  { label: string; className: string }
> = {
  added: {
    label: "New",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  improved: {
    label: "Improved",
    className:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  fixed: {
    label: "Fixed",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  coming: {
    label: "Coming soon",
    className:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChangelogPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {/* Header */}
      <header className="mb-12 border-b border-border pb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Building in public
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Changelog
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Everything we&apos;ve shipped for the Culture store — from first
          commit to the latest drop. Follow along as we build the future of web3
          commerce.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/token">CULT</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/products">Browse Products</Link>
          </Button>
        </div>
      </header>

      {/* Timeline */}
      <div className="relative space-y-0">
        {/* Vertical timeline line */}
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

        {changelog.map((release, idx) => (
          <article key={release.version} className="relative pl-12 pb-10 last:pb-0">
            {/* Timeline dot */}
            <div
              className={`absolute left-[14px] top-1.5 h-[12px] w-[12px] rounded-full border-2 ${
                idx === 0
                  ? "border-primary bg-primary"
                  : "border-border bg-background"
              }`}
            />

            {/* Version + date */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-bold tabular-nums text-foreground">
                v{release.version}
              </span>
              <time className="text-sm text-muted-foreground">
                {release.date}
              </time>
            </div>

            {/* Release title */}
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              {release.title}
            </h2>

            {/* Items */}
            <ul className="mt-3 space-y-2">
              {release.items.map((item) => {
                const badge = BADGE_STYLES[item.type];
                return (
                  <li
                    key={item.text}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase leading-tight ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-muted-foreground">{item.text}</span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-12 rounded-lg border border-primary/30 bg-primary/5 px-5 py-5 text-center">
        <p className="text-sm font-medium text-foreground">
          We ship fast and we ship often. This store was built from scratch
          in 10 days for the{" "}
          <Link href="/token" className="font-semibold text-primary hover:underline">
            CULT
          </Link>{" "}
          community.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Have a feature request?{" "}
          <Link href="/contact" className="underline hover:text-foreground">
            Let us know
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
