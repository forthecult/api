import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ArrowUpRight, Shield } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { cn } from "~/lib/cn";
import { getPartnerUrl, SERVICE_BRAND_LOGOS } from "~/lib/recommended-services";
import { Button } from "~/ui/primitives/button";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: { canonical: `${siteUrl}/services` },
  description:
    "Tools and platforms we use and recommend—DEXs, hardware wallets, private AI, swaps, and privacy. Some links support the project when you sign up.",
  openGraph: {
    description:
      "Curated partners for trading, custody, AI, swaps, and privacy. Clear disclosure; referral links where applicable.",
    title: `Recommended services | ${SEO_CONFIG.name}`,
    type: "website",
    url: `${siteUrl}/services`,
  },
  title: `Recommended services | ${SEO_CONFIG.name}`,
};

export default function ServicesPage() {
  const hyperliquid = getPartnerUrl("hyperliquid");
  const uniswap = getPartnerUrl("uniswap");
  const trezor = getPartnerUrl("trezor");
  const venice = getPartnerUrl("venice");
  const sideshift = getPartnerUrl("sideshift");
  const justdeleteme = getPartnerUrl("justdeleteme");
  const cloaked = getPartnerUrl("cloaked");

  const logos = SERVICE_BRAND_LOGOS;

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
            Partners &amp; picks
          </p>
          <h1
            className={cn(
              "font-heading text-4xl font-bold tracking-tight text-foreground",
              "sm:text-5xl",
            )}
          >
            Recommended services
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            We only list tools we respect and use ourselves.
          </p>
        </div>
      </section>

      <div
        className={`
          border-b border-border bg-amber-500/10 px-4 py-4 text-center text-sm
          text-foreground
        `}
      >
        <strong className="font-semibold">Disclosure:</strong>{" "}
        <span className="text-muted-foreground">
          Paid relationships or affiliate links may apply. We do not let fees
          change our editorial opinion—we recommend what we would use ourselves.
        </span>
      </div>

      <section
        aria-labelledby="dex-heading"
        className={`
          border-b border-border px-4 py-14
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-7xl">
          <h2
            className={`
              font-heading text-2xl font-bold tracking-tight text-foreground
              sm:text-3xl
            `}
            id="dex-heading"
          >
            Decentralized exchanges
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Non-custodial venues for spot, perps, and liquidity—keep keys in
            your wallet, not on someone else’s spreadsheet.
          </p>

          <article
            className={cn(
              `
                mt-14 grid min-h-[70vh] items-center gap-10
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <IconPanel
              className={`
                mx-auto bg-gradient-to-br from-emerald-600/90 via-teal-700/90
                to-slate-900
                md:mx-0
              `}
            >
              <BrandLogo label="Hyperliquid" src={logos.hyperliquid} />
            </IconPanel>
            <div>
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                Hyperliquid
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                High-performance on-chain perpetuals and spot
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                <span className="text-foreground">Hyperliquid</span> is a
                decentralized exchange stack built for traders who want deep
                liquidity and fast execution without handing custody to a
                traditional broker. The L1 is purpose-built for trading: order
                books and matching live on-chain, fees are transparent, and you
                interact from your own wallet.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                We like it for serious size and perps workflows where UX and
                throughput matter. Pair it with a hardware wallet and sane
                position sizing—leverage is a tool, not a personality.
              </p>
              <div className="mt-8">
                <PartnerCta href={hyperliquid}>Open Hyperliquid</PartnerCta>
              </div>
            </div>
          </article>

          <article
            className={cn(
              `
                mt-20 grid min-h-[70vh] items-center gap-10 border-t
                border-border pt-20
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <div
              className={`
                order-2
                md:order-1
              `}
            >
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                Uniswap
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Battle-tested AMM for tokens and LP
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                When you need spot swaps, routing across pools, or liquidity
                provision with transparent math, Uniswap remains the default
                many ecosystems forked from for a reason. Audited contracts,
                wide asset coverage, and a simple mental model: pools, not order
                books.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Use it alongside Hyperliquid-style venues depending on whether
                you are optimizing for classic AMM liquidity or perp-specific
                infrastructure—different jobs, both DeFi-native.
              </p>
              <div className="mt-8">
                <PartnerCta href={uniswap}>Go to Uniswap</PartnerCta>
              </div>
            </div>
            <IconPanel
              className={`
                order-1 mx-auto bg-gradient-to-br from-pink-600/90
                via-fuchsia-700/90 to-slate-900
                md:order-2 md:mx-0
              `}
            >
              <BrandLogo label="Uniswap" src={logos.uniswap} />
            </IconPanel>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="wallets-heading"
        className={`
          border-b border-border bg-muted/15 px-4 py-14
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-7xl">
          <h2
            className={`
              font-heading text-2xl font-bold tracking-tight text-foreground
              sm:text-3xl
            `}
            id="wallets-heading"
          >
            Hardware wallets
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Cold storage beats hot takes. One device holds the keys that sign
            your transactions offline.
          </p>

          <article
            className={cn(
              `
                mt-14 grid min-h-[85vh] items-start gap-10
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <IconPanel
              className={`
                mx-auto bg-gradient-to-br from-green-600/90 via-emerald-800/90
                to-zinc-950
                md:mx-0
              `}
            >
              <BrandLogo label="Trezor" src={logos.trezor} />
            </IconPanel>
            <div>
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                Trezor
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Our pick over Ledger—for transparency and control
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                We recommend Trezor because the project’s heart has always been
                verifiable, open firmware and a security model that does not
                depend on trusting a black box you cannot inspect. Trezor
                pioneered hardware-wallet UX for Bitcoin and altcoins with a
                simple promise: keys never leave the device, and the community
                can review what actually runs on it.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Ledger</span>{" "}
                makes capable devices, but we are cooler on closed-source
                firmware and vendor-led “recover” features that reintroduce
                trust assumptions many of us moved to hardware wallets to avoid.
                Trezor’s direction keeps aligning with “you own the keys, you
                read the code, you decide”—which matches how we think about
                sovereignty in crypto and in culture.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Practical upshot: if you want transparent security culture,
                regular firmware transparency, and a team that markets less
                “lifestyle” and more “prove it,” Trezor is the line we put in
                front of friends. Buy from the manufacturer or an authorized
                reseller, verify the packaging, and always set up with a fresh
                seed you wrote down offline.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PartnerCta href={trezor}>Shop Trezor</PartnerCta>
                <Button asChild variant="outline">
                  <Link href="/hardware-wallets">
                    Trezor in our store
                    <ArrowUpRight aria-hidden className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="ai-heading"
        className={`
          border-b border-border px-4 py-14
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-7xl">
          <h2
            className={`
              font-heading text-2xl font-bold tracking-tight text-foreground
              sm:text-3xl
            `}
            id="ai-heading"
          >
            AI
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Models are commodities; privacy and policy are not.
          </p>

          <article
            className={cn(
              `
                mt-14 grid min-h-[75vh] items-center gap-10
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <IconPanel
              className={`
                mx-auto bg-gradient-to-br from-violet-600/90 via-indigo-800/90
                to-slate-950
                md:mx-0
              `}
            >
              <BrandLogo label="Venice" src={logos.venice} />
            </IconPanel>
            <div>
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                Venice
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Private-by-design inference—not another data-harvesting chatbot
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Most “frontier” models are frontiers for collecting your
                prompts. Venice flips the incentive: access strong
                open-weights-style capabilities with a product stance that
                treats your conversations as yours, not training fodder. For
                anyone building in public—creators, degens, or teams—that
                difference is not cosmetic; it is the difference between tooling
                you can trust with strategy and tooling you should assume is
                leaking.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Compared to generic consumer chat apps tied to ad businesses or
                opaque enterprise APIs, Venice is the stack we reach for when we
                want capable models without normalizing surveillance as the
                price of intelligence. It pairs naturally with how we run
                Culture AI: powerful, but not creepy-by-default.
              </p>
              <p className="mt-4 leading-relaxed text-foreground">
                New users get $10 in credit when they sign up through our Venice
                link (subject to Venice’s current offer terms).
              </p>
              <div className="mt-8">
                <PartnerCta href={venice}>Try Venice</PartnerCta>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="swap-heading"
        className={`
          border-b border-border bg-muted/15 px-4 py-14
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-7xl">
          <h2
            className={`
              font-heading text-2xl font-bold tracking-tight text-foreground
              sm:text-3xl
            `}
            id="swap-heading"
          >
            Swap
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Move between assets without depositing to a custodial exchange—mind
            spreads, confirmations, and opsec.
          </p>

          <article
            className={cn(
              `
                mt-14 grid min-h-[70vh] items-center gap-10
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <IconPanel
              className={`
                mx-auto bg-gradient-to-br from-cyan-600/90 via-blue-800/90
                to-slate-950
                md:mx-0
              `}
            >
              <BrandLogo label="SideShift" src={logos.sideshift} />
            </IconPanel>
            <div>
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                SideShift
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Fast cross-asset shifts with minimal account drama
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                SideShift focuses on what swap users actually want: pick assets,
                send funds, receive output—without a long-lived custody
                relationship. Flows are streamlined for hopping chains and pairs
                when you already know what you are doing and just need rails.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                We like it next to native DEX trading when you want a simple
                swap-shaped UX instead of managing pool routes yourself. Compare
                the quoted rate to what you would get on-chain before you move
                size.
              </p>
              <div className="mt-8">
                <PartnerCta href={sideshift}>Swap with SideShift</PartnerCta>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="privacy-heading"
        className={`
          border-b border-border px-4 py-14
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-7xl">
          <h2
            className={`
              font-heading text-2xl font-bold tracking-tight text-foreground
              sm:text-3xl
            `}
            id="privacy-heading"
          >
            Privacy &amp; accounts
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Fewer accounts hanging open, fewer inboxes tied to your real
            identity.
          </p>

          <article
            className={cn(
              `
                mt-14 grid min-h-[70vh] items-center gap-10
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <IconPanel
              className={`
                mx-auto bg-gradient-to-br from-rose-700/90 via-red-900/90
                to-zinc-950
                md:mx-0
              `}
            >
              <BrandLogo label="JustDeleteMe" src={logos.justdeleteme} />
            </IconPanel>
            <div>
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                JustDeleteMe
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Direct links to close accounts—before they close you
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                JustDeleteMe catalogs how hard it is to delete your account
                across popular sites and points you to the real deletion
                flows—not the “deactivate” theater some services prefer. Use it
                when you are pruning old sign-ups or doing a periodic privacy
                audit.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                It is an open project maintained for the public good; we keep it
                in our bookmarks alongside password managers and hardware
                wallets.
              </p>
              <div className="mt-8">
                <PartnerCta href={justdeleteme}>Open JustDeleteMe</PartnerCta>
              </div>
            </div>
          </article>

          <article
            className={cn(
              `
                mt-20 grid min-h-[70vh] items-center gap-10 border-t
                border-border pt-20
                md:grid-cols-2 md:gap-14
              `,
            )}
          >
            <div
              className={`
                order-2
                md:order-1
              `}
            >
              <h3
                className={`font-heading text-2xl font-semibold text-foreground`}
              >
                Cloaked
              </h3>
              <p className="mt-3 text-sm font-medium text-primary">
                Email aliases that do not leak your real address
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Cloaked generates unique email addresses you can hand to
                retailers, newsletters, and random forms. Replies route where
                you want; your primary inbox stays out of resale databases and
                breach dumps.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                We recommend it when you want account hygiene without juggling
                throwaway inboxes manually—especially for crypto exchanges,
                travel, and anything that might spam you for years.
              </p>
              <div className="mt-8">
                <PartnerCta href={cloaked}>Get Cloaked</PartnerCta>
              </div>
            </div>
            <IconPanel
              className={`
                order-1 mx-auto bg-gradient-to-br from-slate-600/90
                via-slate-800/90 to-zinc-950
                md:order-2 md:mx-0
              `}
            >
              <BrandLogo label="Cloaked" src={logos.cloaked} />
            </IconPanel>
          </article>
        </div>
      </section>

      <section className="border-t border-border px-4 py-14">
        <div
          className={`
            container mx-auto w-full max-w-7xl rounded-xl border border-border
            bg-card/50 p-8 text-center
          `}
        >
          <Shield
            aria-hidden
            className="mx-auto mb-4 h-10 w-10 text-primary"
            strokeWidth={1.25}
          />
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Security, not hype
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Nothing here is financial advice. Links may pay us; they do not
            replace your own research. Verify URLs, bookmark the real sites, and
            stay skeptical of DMs promising “support.”
          </p>
        </div>
      </section>
    </div>
  );
}

function BrandLogo({ label, src }: { label: string; src: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className="object-contain p-10"
      height={200}
      sizes="(max-width: 768px) 80vw, 200px"
      src={src}
      title={label}
      width={200}
    />
  );
}

function IconPanel({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        `
          relative flex aspect-square w-full max-w-[min(100%,320px)]
          items-center justify-center overflow-hidden rounded-2xl border
          border-border
        `,
        className,
      )}
    >
      {children}
    </div>
  );
}

function PartnerCta({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Button asChild className="gap-2" size="lg">
      <Link
        href={href}
        rel="noopener noreferrer nofollow sponsored"
        target="_blank"
      >
        {children}
        <ArrowUpRight aria-hidden className="h-4 w-4" />
      </Link>
    </Button>
  );
}
