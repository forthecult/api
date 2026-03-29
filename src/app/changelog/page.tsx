import type { Metadata } from "next";

import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { Button } from "~/ui/primitives/button";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/changelog`,
  },
  description:
    "Follow along as we build the future of web3 commerce. Every feature, improvement, and milestone — documented.",
  openGraph: {
    description:
      "Follow along as we build the future of web3 commerce. Every feature, improvement, and milestone — documented.",
    title: `Changelog | ${SEO_CONFIG.name}`,
    type: "website",
  },
  title: `Changelog | ${SEO_CONFIG.name}`,
};

/* ------------------------------------------------------------------ */
/*  Changelog data                                                     */
/* ------------------------------------------------------------------ */

interface ChangelogEntry {
  date: string;
  items: {
    text: string;
    /** "added" = new feature, "improved" = enhancement, "fixed" = bug fix, "coming" = unreleased */
    type: "added" | "coming" | "fixed" | "improved";
  }[];
  title: string;
  version: string;
}

const changelog: ChangelogEntry[] = [
  {
    date: "March 28, 2026",
    items: [
      {
        text: "Always-visible product search in the site header — type and go, no modal to open first",
        type: "added",
      },
      {
        text: "Blog for news, guides, and long-form stories from the team",
        type: "added",
      },
      {
        text: "New AI chat with characters, companions, and projects",
        type: "added",
      },
      {
        text: "Web page optimizations — faster loads, leaner bundles, and smoother experience across the storefront",
        type: "improved",
      },
    ],
    title: "Blog, search, AI chat & performance",
    version: "1.0",
  },
  {
    date: "March 14, 2026",
    items: [
      {
        text: "Agent skills for contributors: documented store API, checkout fields, and culture conventions for AI-assisted work in the repo",
        type: "added",
      },
    ],
    title: "Agent skills & editor guidance",
    version: "0.99",
  },
  {
    date: "February 28, 2026",
    items: [
      {
        text: "Membership tiers with Culture AI access, shipping perks, and eSIM benefits",
        type: "added",
      },
      {
        text: "Native Android app (Expo / React Native) with Solana Mobile Wallet Adapter for wallet-native browsing and orders",
        type: "added",
      },
    ],
    title: "Membership & mobile app",
    version: "0.98",
  },
  {
    date: "February 14, 2026",
    items: [
      {
        text: "Alice as the unified AI guide across website chat, Telegram, and Discord with shared memory",
        type: "added",
      },
      {
        text: "Dashboard AI hub: personal storage, prompts, and memory under Account → AI",
        type: "added",
      },
    ],
    title: "Alice & personal AI",
    version: "0.97",
  },
  {
    date: "February 10, 2026",
    items: [
      {
        text: "Store statistics dashboard for CULT token holders with real-time sales and product analytics",
        type: "added",
      },
      {
        text: "Staking overview and metrics for CULT token holders",
        type: "added",
      },
      {
        text: "Curated and added high-quality products across all categories with SEO-optimized listings",
        type: "improved",
      },
      {
        text: "Full product catalog optimization — descriptions, images, tags, and meta data for every listing",
        type: "improved",
      },
      {
        text: "Organized product categories with a redesigned mega menu for faster navigation",
        type: "improved",
      },
      {
        text: "Populated XML sitemap for improved search engine indexing",
        type: "improved",
      },
    ],
    title: "Token holder features & store optimization",
    version: "0.9",
  },
  {
    date: "February 8, 2026",
    items: [
      {
        text: "Product category system with parent/child hierarchy and SEO-optimized category pages",
        type: "added",
      },
      {
        text: "Email and web push notifications with per-user customization preferences",
        type: "added",
      },
      {
        text: "BTCPay Server integration for Bitcoin, Dogecoin, and Monero payments",
        type: "added",
      },
      {
        text: "Comprehensive security audit of all API endpoints and checkout flows",
        type: "improved",
      },
    ],
    title: "Categories, notifications & security",
    version: "0.8",
  },
  {
    date: "February 7, 2026",
    items: [
      {
        text: "Telegram web app for browsing and purchasing directly inside Telegram",
        type: "added",
      },
      {
        text: "Telegram authentication and real-time order notifications via Telegram bot",
        type: "added",
      },
      {
        text: "EVM wallet authentication — connect with MetaMask, WalletConnect, and other Ethereum wallets",
        type: "added",
      },
      {
        text: "EVM payment methods for Ethereum-based transactions at checkout",
        type: "added",
      },
    ],
    title: "Telegram integration & EVM support",
    version: "0.7",
  },
  {
    date: "February 6, 2026",
    items: [
      {
        text: "Custom live chat support widget with planned AI assistant integration",
        type: "added",
      },
      {
        text: "Contact page with authenticated ticketing system for customer support",
        type: "added",
      },
      {
        text: "Discount codes and coupon functionality at checkout",
        type: "added",
      },
      {
        text: "Extended public API for agentic commerce — enabling AI agents and bots to browse, search, and transact",
        type: "improved",
      },
    ],
    title: "Customer support & agentic commerce",
    version: "0.6",
  },
  {
    date: "February 5, 2026",
    items: [
      {
        text: "Order tracking page with real-time shipment status and carrier integration",
        type: "added",
      },
      {
        text: "Self-service refund request page for streamlined returns",
        type: "added",
      },
      {
        text: "Affiliate program with unique referral links, tracking, and commission payouts",
        type: "added",
      },
    ],
    title: "Order management & affiliate program",
    version: "0.5",
  },
  {
    date: "February 4, 2026",
    items: [
      {
        text: "U2F / hardware key authentication for enhanced account security",
        type: "added",
      },
      {
        text: "SPL token gating on product and category pages — restrict access based on Solana token holdings",
        type: "added",
      },
      {
        text: "Shipping calculator with real-time rate estimates by destination",
        type: "added",
      },
    ],
    title: "Security, token gating & shipping",
    version: "0.4",
  },
  {
    date: "February 3, 2026",
    items: [
      {
        text: "Public REST API for developers, AI agents, and third-party integrations",
        type: "added",
      },
      {
        text: "Solana wallet authentication and account creation — shop without an email address",
        type: "added",
      },
      {
        text: "Wishlist functionality for saving and sharing favorite products",
        type: "added",
      },
      {
        text: "Product reviews system with imported customer reviews from our original store",
        type: "added",
      },
    ],
    title: "Web3 identity & community features",
    version: "0.3",
  },
  {
    date: "February 2, 2026",
    items: [
      {
        text: "Stripe payment integration for credit and debit card checkout",
        type: "added",
      },
      {
        text: "Address autocomplete and validation for faster, error-free checkout",
        type: "added",
      },
      {
        text: "Support for 100+ countries and multiple fiat currencies with localized pricing",
        type: "added",
      },
    ],
    title: "Payment infrastructure & global reach",
    version: "0.2",
  },
  {
    date: "February 1, 2026",
    items: [
      {
        text: "Forked and customized the Relivator Next.js 15 template as the store foundation",
        type: "added",
      },
      {
        text: "Built the admin dashboard for product, order, and inventory management",
        type: "added",
      },
      {
        text: "Integrated Solana Pay for SOL and USDC payments at checkout",
        type: "added",
      },
      {
        text: "Live crypto pricing widget with real-time conversion rates",
        type: "added",
      },
    ],
    title: "Foundation",
    version: "0.1",
  },
];

/* ------------------------------------------------------------------ */
/*  Badge colors by entry type                                         */
/* ------------------------------------------------------------------ */

const BADGE_STYLES: Record<
  ChangelogEntry["items"][number]["type"],
  { className: string; label: string }
> = {
  added: {
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    label: "New",
  },
  coming: {
    className:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    label: "Planned",
  },
  fixed: {
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    label: "Fixed",
  },
  improved: {
    className:
      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    label: "Improved",
  },
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChangelogPage() {
  return (
    <div
      className={`
      container mx-auto max-w-7xl px-4 py-12
      sm:px-6 sm:py-16
      lg:px-8
    `}
    >
      {/* Header */}
      <header className="mb-12 border-b border-border pb-10">
        <p
          className={`
          text-xs font-semibold tracking-wider text-primary uppercase
        `}
        >
          Building in public
        </p>
        <h1
          className={`
          mt-2 text-3xl font-bold tracking-tight text-foreground
          sm:text-4xl
        `}
        >
          Changelog
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Everything we&apos;ve shipped for the Culture store — from first
          commit to the latest drop. Follow along as we build the future of web3
          commerce.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/token">CULT</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/products">Browse Products</Link>
          </Button>
        </div>
      </header>

      {/* Timeline */}
      <div className="relative space-y-0">
        {/* Vertical timeline line */}
        <div className="absolute top-2 bottom-2 left-[19px] w-px bg-border" />

        {changelog.map((release, idx) => (
          <article
            className={`
              relative pb-10 pl-12
              last:pb-0
            `}
            key={release.version}
          >
            {/* Timeline dot */}
            <div
              className={`
                absolute top-1.5 left-[14px] h-[12px] w-[12px] rounded-full
                border-2
                ${
                  idx === 0
                    ? "border-primary bg-primary"
                    : "border-border bg-background"
                }
              `}
            />

            {/* Version + date */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className={`
                rounded-md bg-muted px-2 py-0.5 text-sm font-bold
                text-foreground tabular-nums
              `}
              >
                v{release.version}
              </span>
              <time className="text-sm text-muted-foreground">
                {release.date}
              </time>
            </div>

            {/* Release title */}
            <h2
              className={`
              mt-2 text-lg font-semibold tracking-tight text-foreground
            `}
            >
              {release.title}
            </h2>

            {/* Items */}
            <ul className="mt-3 space-y-2">
              {release.items.map((item) => {
                const badge = BADGE_STYLES[item.type];
                return (
                  <li
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                    key={item.text}
                  >
                    <span
                      className={`
                        mt-0.5 shrink-0 rounded border px-1.5 py-px text-[10px]
                        leading-tight font-semibold uppercase
                        ${badge.className}
                      `}
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
      <div
        className={`
        mt-12 rounded-lg border border-primary/30 bg-primary/5 px-5 py-5
        text-center
      `}
      >
        <p className="text-sm font-medium text-foreground">
          We ship fast and we ship often. This store was built from scratch in
          10 days for the{" "}
          <Link
            className={`
              font-semibold text-primary
              hover:underline
            `}
            href="/token"
          >
            CULT
          </Link>{" "}
          community.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Have a feature request?{" "}
          <Link
            className={`
            underline
            hover:text-foreground
          `}
            href="/contact"
          >
            Let us know
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
