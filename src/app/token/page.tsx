import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Scale,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

export const metadata = {
  title: `CULT Token | ${SEO_CONFIG.name}`,
  description:
    "Fair launch utility token for the CULT community. Governance rights and up to 20% discount on eligible purchases.",
};

const valueCards = [
  {
    title: "Equal Pricing",
    description:
      "No preferential pricing. Everyone participates in the same price discovery on the bonding curve.",
    icon: Scale,
  },
  {
    title: "Transparent",
    description:
      "All distribution documented and verifiable on-chain. No hidden allocations or insider deals.",
    icon: Shield,
  },
  {
    title: "Voting",
    description:
      "Token holders will participate in our direction.",
    icon: Users,
  },
  {
    title: "Real Utility",
    description:
      "Up to 20% discount when used for eligible purchases at checkout.",
    icon: Zap,
  },
];

const allocationItems = [
  {
    label: "Public (fair launch)",
    sublabel: "Fair launch bonding curve",
    pct: "86.63%",
  },
  {
    label: "Team (locked)",
    sublabel: "6-month lockup via Streamflow",
    pct: "10%",
  },
  {
    label: "Team (unlocked)",
    sublabel: "Voting participation",
    pct: "3.37%",
  },
];

const fairLaunchPrinciples = [
  "Team allocation 13.37% (middle of 10-20% range)",
  "Public allocation exceeds 30% min (86.63%)",
  "10% locked 6 months via Streamflow (verifiable on-chain)",
  "3.37% unlocked so team can participate in voting from day one",
];

const cultureUnique = [
  "Clean, quality, products that improve physical and mental wellness.",
  "We make it easy for our AI companion to make purchases.",
  "No trackers. We won't follow you around the internet.",
  "We use technology to lower costs, make the supply chain more transparent, and improve our customers' lives.",
  "Bringing digital to physical to make the supply chain more transparent and the metaverse more interactive.",
  "Data deletion. No required account creation. No Shopify. We remove your address, phone number, and email 30 days after order placement (unless you want us to send you feature updates).",
];

const SOLSCAN_BASE = "https://solscan.io/account";

/** Creator fee allocation: value is numeric % for pie chart; chartLabel = short text on pie. subjectToChange = show * and note below table. */
const creatorFeeAllocations = [
  { value: 5, pct: "5%", label: "Buy back and burn", chartLabel: "5% Buy back & burn", wallet: "UvbzCHxWyJc5uFoQc44sFRDucLV3AuWLoB3nfPtBURN", subjectToChange: false },
  { value: 5, pct: "5%", label: "Staked token holders", chartLabel: "5% Staked holders", wallet: "y5srMcHfM6efwhGQnNKfJJkfBQ72WRysRpnEYxtCULT", subjectToChange: false },
  { value: 5, pct: "5%", label: "Charity", chartLabel: "5% Charity", wallet: "fuyyUTbX6dKebrKN3iHA6QHA3TP8aFnijheHsvzG1VE", subjectToChange: false },
  { value: 15, pct: "15%", label: "Marketing and advertising", chartLabel: "13.37% Marketing", wallet: "CULTm4oWmx6vdD7GG6mAiQ4fDtjiHuM1H9QxZhbnAYJd", subjectToChange: true },
  { value: 20, pct: "20%", label: "Subsidize shipping and product prices", chartLabel: "20% Shipping & prices", chartLabelOutset: 14, wallet: "CULTrfVi9B2XCDvs9DJWqFjqKn6vzLgTfnxissZY77VJ", subjectToChange: true },
  { value: 20, pct: "20%", label: "Product inventory and development", chartLabel: "20% Product & inventory", wallet: "CULTvM6qwhTvobG6qE4d9fVwuWsMRVokpdzE11sHDcYm", subjectToChange: true },
  { value: 30, pct: "30%", label: "Treasury and feature development", chartLabel: "30% Treasury", wallet: "CULTwLwp92fMZUT5EgtCdduuMsjqrsWvygQ3SjPuEDJb", subjectToChange: true },
];

/** Conic-gradient colors. Last (30% Treasury) uses primary so the biggest slice stands out. */
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
  "var(--primary)", // 30% Treasury – primary for largest slice
];
function creatorFeePieGradient(): string {
  let cum = 0;
  const stops = creatorFeeAllocations.map((a, i) => {
    const start = cum;
    cum += a.value;
    return `${PIE_COLORS[i]} ${start}% ${cum}%`;
  });
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

const faqItems = [
  {
    q: "Why launch on pump.fun?",
    a: "Pump.fun aligns with fair launch principles: equal pricing for everyone, no presale, transparent distribution. Everyone starts at the same price on the bonding curve with no structural advantages for insiders.",
  },
  {
    q: "Why 13.37% team allocation?",
    a: "Fair launch standards recommend team allocations between 10-20%. We chose 13.37%—the middle path. 10% is locked for 6 months via Streamflow (verifiable on-chain). 3.37% is unlocked so the team can participate in DAO governance from day one.",
  },
  {
    q: "What creates demand for CULT?",
    a: "The CULT token provides a 13.37% discount when used for eligible purchases at checkout, giving it utility within the CULT ecosystem.",
  },
  {
    q: "How does the voting work?",
    a: "The CULT community is being organized as a DAO, intended to provide a framework for decentralized governance. Once established, CULT token holders will be able to participate in governance decisions about protocol upgrades, fee structures, and the future of the ecosystem.",
  },
];

export default function TokenPage() {
  return (
    <div
      className={`
        flex min-h-screen flex-col gap-y-16 bg-gradient-to-b from-muted/50
        via-muted/25 to-background
      `}
    >
      <div
        className={`
          container mx-auto max-w-7xl px-4
          sm:px-6
          lg:px-8
        `}
      >
        {/* Web3 eCommerce lead */}
        <section className="border-b border-border py-8 md:py-10">
          <p className="mx-auto max-w-2xl text-center text-lg text-muted-foreground md:text-xl">
            When you search &apos;web3 eCommerce&apos; you&apos;ll find dozens of
            articles about the benefits, but no one is doing it the way it
            should be. At least, not with physical products. We&apos;re here to
            change that.
          </p>
        </section>

        {/* Hero */}
        <section className="relative overflow-hidden py-12 md:py-16">
          <div className="relative z-10 mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-base font-medium text-muted-foreground">
              {SEO_CONFIG.name}
            </p>

            <h1
              className={`
                font-display text-4xl font-bold leading-tight tracking-tight
                text-foreground sm:text-5xl md:text-6xl
              `}
            >
              <span
                className={`
                  bg-gradient-to-r from-primary to-primary/70 bg-clip-text
                  text-transparent
                `}
              >
                CULT Token
              </span>
            </h1>
            <p className="text-muted-foreground">
              Holding CULT gives free shipping. Spending CULT gives up to 20%
              discount on eligible purchases. We kept 13.37% for the team. You get
              the rest.
            </p>
          </div>
        </section>

        {/* Why Pump.fun, value cards, then What CULT Gets You */}
        <section className="space-y-10 py-6 md:py-6">
          <div className="space-y-6">
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Why Pump.fun?
            </h2>
            <p className="max-w-3xl text-muted-foreground">
              We believe in fair launches. Pump.fun was the natural choice.
            </p>
            <p className="max-w-3xl text-muted-foreground">
              We chose pump.fun because it embodies fair launch principles:
              equal pricing for everyone, transparent distribution, and no
              structural advantages for insiders. No VCs means no one telling us
              what to do. We answer to the community, not investors. The token
              launches on the bonding curve—everyone starts at the same price.
            </p>
          </div>

          {/* Value cards (4 boxes) */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {valueCards.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-border bg-card">
                <CardHeader>
                  <Icon className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">{title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">
                    {description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <p className="text-base font-medium italic text-foreground/90 sm:text-lg">
              A new Age of eCommerce
            </p>
            <h3 className="font-display text-xl font-semibold text-foreground md:text-2xl">
              What CULT gets you
            </h3>
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Free Shipping</strong> if
                you hold 250,000 or more tokens in your wallet
              </li>
              <li>
                <strong className="text-foreground">Up to 20% discount</strong>{" "}
                on eligible purchases at checkout
              </li>
              <li>
                <strong className="text-foreground">Exclusive access</strong> to
                select products and aggregate store sales data
              </li>
              <li>
                <strong className="text-foreground">Participation</strong> in
                product offering decisions
              </li>
                            <li>
                <strong className="text-foreground">Future</strong> member perks and discounts as we grow
              </li>
            </ul>
          </div>
        </section>

        {/* Proposed Token Allocation */}
        <section className="space-y-8 py-12 md:py-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Proposed token allocation
            </h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Following fair launch standards: team 10–20%, public ≥30%,
              transparent vesting. We believe in the middle path.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {allocationItems.map(({ label, sublabel, pct }) => (
              <Card key={label} className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    {sublabel}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {pct}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Fair Launch Principles */}
        <section className="space-y-6 py-6 md:py-6">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Fair launch principles
          </h2>
          <ul className="space-y-3">
            {fairLaunchPrinciples.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-muted-foreground"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Creator Fee Allocation */}
        <section className="space-y-8 py-16 md:py-12">
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
              Creator Fee Allocation
            </h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Fee splits are sent to dedicated wallets. Verified allocations can
              be viewed on Solscan.
            </p>
          </div>
          <div className="flex flex-col gap-10">
            {/* Pie chart: viewBox 130; pie radius 42. Lines run from pie to fixed rLineEnd (equal length); labels at rLabel so text sits behind lines (drawn first). */}
            <div className="flex flex-col items-center overflow-visible px-2 py-8 md:px-6 md:py-10">
              <div
                className="relative w-full max-w-[380px] overflow-visible"
                style={{ aspectRatio: "1" }}
              >
                {/* Gradient pie: center 50,50 radius 42 → 84 units; viewBox 130 → pie 84/130 ≈ 65% of container */}
                <div
                  className="absolute left-1/2 top-1/2 h-[65%] w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background shadow-lg"
                  style={{ background: creatorFeePieGradient() }}
                  aria-hidden
                />
                <svg
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox="-10 -10 130 130"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  {(() => {
                    const rPie = 42
                    const rLineEnd = 58
                    const rLabel = 70
                    const outset = (a: (typeof creatorFeeAllocations)[number]) =>
                      "chartLabelOutset" in a && typeof (a as { chartLabelOutset?: number }).chartLabelOutset === "number"
                        ? (a as { chartLabelOutset: number }).chartLabelOutset
                        : 0
                    let cum = 0
                    const points = creatorFeeAllocations.map((a) => {
                      const midDeg = (cum + a.value / 2) * 3.6
                      cum += a.value
                      const rad = (midDeg * Math.PI) / 180
                      const o = outset(a)
                      const lineEnd = rLineEnd + o
                      const labelR = rLabel + o
                      return {
                        key: a.label,
                        xEdge: 50 + rPie * Math.sin(rad),
                        yEdge: 50 - rPie * Math.cos(rad),
                        xLineEnd: 50 + lineEnd * Math.sin(rad),
                        yLineEnd: 50 - lineEnd * Math.cos(rad),
                        xLabel: 50 + labelR * Math.sin(rad),
                        yLabel: 50 - labelR * Math.cos(rad),
                        chartText:
                          "chartLabel" in a && typeof a.chartLabel === "string"
                            ? a.chartLabel
                            : `${a.pct} ${a.label}`,
                      }
                    })
                    return (
                      <>
                        {/* Labels drawn first so lines render on top (words behind lines) */}
                        {points.map((p) => (
                          <text
                            key={`${p.key}-text`}
                            x={p.xLabel}
                            y={p.yLabel}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-foreground font-medium"
                            style={{ fontSize: "6px" }}
                          >
                            {p.chartText}
                          </text>
                        ))}
                        {/* Connector lines: same length for all (pie edge to rLineEnd), drawn on top of text */}
                        {points.map((p) => (
                          <line
                            key={`${p.key}-line`}
                            x1={p.xEdge}
                            y1={p.yEdge}
                            x2={p.xLineEnd}
                            y2={p.yLineEnd}
                            stroke="var(--muted-foreground)"
                            strokeWidth="0.8"
                            strokeOpacity={0.8}
                          />
                        ))}
                      </>
                    )
                  })()}
                </svg>
              </div>
            </div>
            {/* Table directly below pie chart */}
            <div className="min-w-0 rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5rem]">Allocation</TableHead>
                    <TableHead>Use</TableHead>
                    <TableHead className="min-w-0 font-mono text-sm text-muted-foreground">
                      Address
                    </TableHead>
                    <TableHead className="min-w-[7.5rem] text-right">
                      On-chain
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorFeeAllocations.map(({ pct, label, wallet, subjectToChange }) => (
                    <TableRow key={label}>
                      <TableCell className="font-medium tabular-nums">
                        {pct}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {subjectToChange ? `${label}*` : label}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate font-mono text-sm text-muted-foreground" title={wallet ?? undefined}>
                        {wallet ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {wallet ? (
                          <a
                            href={`${SOLSCAN_BASE}/${wallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View on Solscan
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              * Note: subject to change
            </p>
          </div>
        </section>

        {/* Hackathon Funding */}
        <section className="space-y-6 py-6 md:py-6">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Hackathon Funding
          </h2>
          <p className="max-w-3xl text-muted-foreground">
            Funds will be used for:
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-muted-foreground">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>Investment into phygital infrastructure</span>
            </li>
            <li className="flex items-start gap-3 text-muted-foreground">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>Supply chain transparency</span>
            </li>
            <li className="flex items-start gap-3 text-muted-foreground">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>Agentic commerce</span>
            </li>
            <li className="flex items-start gap-3 text-muted-foreground">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>Economies of scale for token member perks and rewards</span>
            </li>
          </ul>
          <div className="mt-4">
            <Link href="/changelog">
              <Button variant="outline" size="sm" className="gap-2">
                View full changelog
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Culture */}
        <section className="space-y-6 py-6 md:py-6">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            What's unique about Culture
          </h2>
          <ul className="space-y-3">
            {cultureUnique.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-muted-foreground"
              >
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/*  Governance */}
        <section className="space-y-8 py-12 md:py-16">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Voting
          </h2>
          <p className="max-w-3xl text-muted-foreground">
            We believe the community should decide the future of the ecosystem.
          </p>
          <div className="grid gap-8 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Voting rights</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-base text-muted-foreground">
                  <li>Charity funds allocation</li>
                  <li>Determine new products and features</li>
                  <li>Become a DAO one day? It's possible!</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Why a DAO in the future?</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-inside list-disc space-y-1 text-base text-muted-foreground">
                  <li>Better capital management</li>
                  <li>Clear framework for decentralized operations</li>
                  <li>Path to community governance</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Token FAQ (dropdown accordion like tns.id/token) */}
        <section className="space-y-6 py-6 md:py-6">
          <h2 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
            Token FAQ
          </h2>
          <div className="space-y-0">
            {faqItems.map(({ q, a }) => (
              <details
                key={q}
                className="border-b border-border last:border-b-0 [&[open]_svg]:rotate-180 [&:first-child]:rounded-t-lg [&:last-child]:rounded-b-lg"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-4 pr-2 font-medium text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
                  <span>{q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform" />
                </summary>
                <p className="pb-4 pr-8 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            {/* Stake & Vote link hidden until prod testing complete */}
            <Link href="/products">
              <Button size="lg" variant="outline" className="gap-2">
                Shop with CULT at checkout
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-base text-muted-foreground">
            Use CULT token at checkout for up to 20% off eligible purchases.
          </p>
        </section>

        {/* Disclaimer */}
        <section className="space-y-4 border-t border-border py-12">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Disclaimer:</strong> The CULT
            ecosystem is under active development. Token mechanics, voting
            structures, and features described here are planned and subject to
            change.
          </p>
          <p className="text-sm text-muted-foreground">
            The CULT token is a utility token intended for use within the
            ecosystem (purchase discounts and voting participation). There is no
            guarantee of financial return. The value of the CULT token may
            fluctuate and you may lose some or all of your purchase amount.
          </p>
          <p className="text-sm text-muted-foreground">
            The purchase and use of CULT tokens may be subject to regulatory
            restrictions in your jurisdiction. This is not financial, legal, or
            investment advice. Please consult with qualified advisors before
            participating. Token holders participate at their own risk.
          </p>
        </section>
      </div>
    </div>
  );
}
