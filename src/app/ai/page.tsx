import type { Metadata } from "next";

import { Check, Minus, Sparkles, X } from "lucide-react";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { Button } from "~/ui/primitives/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/ui/primitives/table";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: { canonical: `${siteUrl}/ai` },
  description:
    "Culture AI — private-by-default chat, character personas, companion memory, and crypto-native perks. Compare to ChatGPT, Gemini, and DeepSeek.",
  openGraph: {
    description:
      "AI that fits how you shop, stake, and show up for the culture. Try it in the store.",
    title: `Culture AI | ${SEO_CONFIG.name}`,
    type: "website",
    url: `${siteUrl}/ai`,
  },
  title: `Culture AI | ${SEO_CONFIG.name}`,
};

function No() {
  return (
    <span className="inline-flex justify-center text-muted-foreground" title="No">
      <X aria-hidden className="h-5 w-5" />
      <span className="sr-only">No</span>
    </span>
  );
}

function Partial() {
  return (
    <span
      className="inline-flex justify-center text-muted-foreground"
      title="Limited or varies"
    >
      <Minus aria-hidden className="h-5 w-5" />
      <span className="sr-only">Limited or varies</span>
    </span>
  );
}

function Yes() {
  return (
    <span className="inline-flex justify-center" title="Yes">
      <Check aria-hidden className="h-5 w-5 text-primary" />
      <span className="sr-only">Yes</span>
    </span>
  );
}

const faqItems: { a: string; q: string }[] = [
  {
    a: "We design Culture AI for commerce and community trust—not for reselling your words. Details live in our privacy policy; we do not use your conversations to train public foundation models.",
    q: "Do you train on my chats?",
  },
  {
    a: "Pick a voice and vibe that matches how you want to plan outfits, trips, or token moves. Characters keep tone consistent so answers feel like a teammate, not a generic assistant.",
    q: "What are characters?",
  },
  {
    a: "Your assistant can remember context across sessions when you are signed in—so follow-ups feel continuous. You stay in control of history and account data from your dashboard.",
    q: "What does companion mean here?",
  },
  {
    a: "Culture AI is wired into the same ecosystem as CULT, staking, and the storefront—so guidance can respect perks, balances, and membership benefits where relevant.",
    q: "How does crypto show up?",
  },
  {
    a: "Pay monthly at $12.99/mo, or choose annual billing at $9.99/mo equivalent (billed once per year). Upgrade paths are available from membership checkout.",
    q: "How does pricing work?",
  },
];

export default function AiLandingPage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section
        className={`
          border-b border-border bg-gradient-to-b from-muted/50 via-background
          to-background px-4 py-16
          sm:py-24
        `}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <p
            className={`
              mb-3 inline-flex items-center gap-2 rounded-full border
              border-border bg-card/60 px-3 py-1 text-xs font-semibold
              tracking-[0.2em] text-primary uppercase
            `}
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Culture AI
          </p>
          <h1
            className={`
              font-heading text-4xl font-bold tracking-tight text-foreground
              sm:text-5xl
            `}
          >
            AI that fits your life
            <span className="block text-primary">and your keys</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Private-by-default chat, character-led tone, companion memory, and
            crypto-native perks—built for the community behind the store.
          </p>
          <div
            className={`
              mt-10 flex flex-col items-center justify-center gap-3
              sm:flex-row sm:gap-4
            `}
          >
            <Button asChild size="lg">
              <Link href="/chat">Start chatting</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/membership">View membership & pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`
        container mx-auto max-w-5xl px-4 py-16
        sm:py-20
      `}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`
            font-heading text-3xl font-bold tracking-tight text-foreground
          `}>
            Built for privacy, personality, and on-chain culture
          </h2>
          <p className="mt-3 text-muted-foreground">
            Four pillars that separate Culture AI from a generic chat box.
          </p>
        </div>
        <ul
          className={`
            mt-12 grid gap-6
            sm:grid-cols-2
          `}
        >
          <li
            className={`
              rounded-xl border border-border bg-card/70 p-6 shadow-sm
              transition-shadow
              hover:shadow-md
            `}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Privacy
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Chat with defaults that respect boundaries—your threads are for
              you and the experiences you opt into, not for open-ended data
              harvesting.
            </p>
          </li>
          <li
            className={`
              rounded-xl border border-border bg-card/70 p-6 shadow-sm
              transition-shadow
              hover:shadow-md
            `}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Characters
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Choose personas that match how you plan: stylist, traveler,
              degen analyst, or calm copilot—consistent voice without losing
              capability.
            </p>
          </li>
          <li
            className={`
              rounded-xl border border-border bg-card/70 p-6 shadow-sm
              transition-shadow
              hover:shadow-md
            `}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Companion
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Pick up where you left off with memory-aware follow-ups when you
              are signed in—so recommendations and plans evolve instead of
              resetting every message.
            </p>
          </li>
          <li
            className={`
              rounded-xl border border-border bg-card/70 p-6 shadow-sm
              transition-shadow
              hover:shadow-md
            `}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Crypto
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Native ties to CULT, staking, and storefront perks mean answers
              can align with how you actually participate—not just generic
              finance trivia.
            </p>
          </li>
        </ul>
      </section>

      {/* Comparison */}
      <section
        className={`
          border-y border-border bg-muted/20 px-4 py-16
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className={`
              font-heading text-3xl font-bold tracking-tight text-foreground
            `}>
              Compare Culture AI
            </h2>
            <p className="mt-3 text-muted-foreground">
              How we stack up on the things privacy- and culture-forward users
              care about—without the jurisdiction flex.
            </p>
          </div>
          <div className="mt-10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Capability</TableHead>
                  <TableHead className="text-center">Culture AI</TableHead>
                  <TableHead className="text-center">Gemini</TableHead>
                  <TableHead className="text-center">ChatGPT</TableHead>
                  <TableHead className="text-center">DeepSeek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    No training on your chats for ads
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Character personas & tone control
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Companion-style memory & continuity
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Crypto-native store & token perks
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Client code open for audit
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <Partial />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Streaming responses
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="whitespace-normal">
                    Tied to a real-world community & brand
                  </TableCell>
                  <TableCell className="text-center">
                    <Yes />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                  <TableCell className="text-center">
                    <No />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Competitor capabilities vary by plan and region; icons summarize
              typical defaults, not legal guarantees.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={`
        container mx-auto max-w-4xl px-4 py-16
        sm:py-20
      `}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className={`
            font-heading text-3xl font-bold tracking-tight text-foreground
          `}>
            Simple pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Unlock full Culture AI alongside membership benefits. Cancel anytime
            on monthly; save with annual.
          </p>
        </div>
        <div
          className={`
            mx-auto mt-10 grid max-w-3xl gap-6
            md:grid-cols-2
          `}
        >
          <div
            className={`
              flex flex-col rounded-xl border border-border bg-card/80 p-6
              shadow-sm
            `}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Pay monthly
            </h3>
            <p className="mt-4">
              <span className={`
                text-4xl font-bold tracking-tight text-foreground
              `}>
                $12.99
              </span>
              <span className="text-muted-foreground">/month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Flexible—stay as long as you like.
            </p>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link href="/membership">Choose monthly</Link>
            </Button>
          </div>
          <div
            className={`
              relative flex flex-col rounded-xl border-2 border-primary bg-card
              p-6 shadow-md
            `}
          >
            <span
              className={`
                absolute -top-3 left-1/2 -translate-x-1/2 rounded-full
                bg-primary px-3 py-0.5 text-xs font-semibold
                text-primary-foreground
              `}
            >
              Best value
            </span>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Pay annually
            </h3>
            <p className="mt-4">
              <span className={`
                text-4xl font-bold tracking-tight text-foreground
              `}>
                $9.99
              </span>
              <span className="text-muted-foreground">/month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Billed yearly—lowest effective rate for committed members.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href="/membership">Save with annual</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className={`
          border-t border-border bg-muted/15 px-4 py-16
          sm:py-20
        `}
      >
        <div className="container mx-auto max-w-3xl">
          <h2 className={`
            font-heading text-center text-3xl font-bold tracking-tight
            text-foreground
          `}>
            Frequently asked questions
          </h2>
          <dl className="mt-10 space-y-4">
            {faqItems.map((item) => (
              <div
                className={`
                  rounded-lg border border-border bg-card/80 px-5 py-4 shadow-sm
                `}
                key={item.q}
              >
                <dt className="font-semibold text-foreground">{item.q}</dt>
                <dd className={`
                  mt-2 text-sm leading-relaxed text-muted-foreground
                `}>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Want the code story?{" "}
            <Link
              className={`
                font-medium text-primary underline underline-offset-4
                hover:text-primary/90
              `}
              href="/open-source"
            >
              Explore our open-source page
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="container mx-auto max-w-3xl px-4 pb-20 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Ready when you are
        </h2>
        <p className="mt-3 text-muted-foreground">
          Jump into Culture AI or line up membership—either way, you are in
          the right place.
        </p>
        <div
          className={`
            mt-8 flex flex-col items-center justify-center gap-3
            sm:flex-row sm:gap-4
          `}
        >
          <Button asChild size="lg">
            <Link href="/chat">Open chat</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href="/products">Shop the store</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
