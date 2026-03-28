import type { Metadata } from "next";

import { Check, ChevronDown, Minus, Sparkles, X } from "lucide-react";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { cn } from "~/lib/cn";
import { getCultureAiProductHref } from "~/lib/culture-ai-public";
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
const cultureAiProductHref = getCultureAiProductHref();

export const metadata: Metadata = {
  alternates: { canonical: `${siteUrl}/ai` },
  description:
    "Culture AI — private-by-default chat, character personas, and companion memory. Compare to ChatGPT, Gemini, and DeepSeek.",
  openGraph: {
    description:
      "Private-by-default assistant with chat, project, and companion modes. Try it in the store.",
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
    a: "Create an account and subscribe to the Culture AI product by itself (checkout is for that subscription), or join membership—Culture AI is included with eligible monthly plans. You can start in guest chat either way.",
    q: "How do I get Culture AI?",
  },
  {
    a: "We design Culture AI for commerce and community trust—not for reselling your words. Details live in our privacy policy; we do not use your conversations to train public foundation models.",
    q: "Do you train on my chats?",
  },
  {
    a: "Pick a voice and vibe that matches how you plan outfits, trips, or research. Characters keep tone consistent so answers feel like a teammate, not a generic assistant.",
    q: "What are characters?",
  },
  {
    a: "Chat is quick back-and-forth. Project mode keeps a durable thread for multi-step work. Companion mode leans on memory and continuity when you are signed in—so follow-ups feel continuous.",
    q: "What are chat, project, and companion modes?",
  },
  {
    a: "$12.99/mo and $9.99/mo (annual effective rate) refer to the Culture AI subscription product—add it to your cart from the product page and check out. Membership has its own tier pricing on the membership page and is not the same as those AI subscription prices.",
    q: "How does pricing work?",
  },
];

export default function AiLandingPage() {
  return (
    <div className="bg-background">
      <section
        className={cn(
          "border-b border-border bg-gradient-to-b from-muted/50 via-background",
          `
            to-background px-4 py-16
            sm:py-24
          `,
        )}
      >
        <div className="container mx-auto max-w-4xl text-center">
          <p
            className={cn(
              `
                mb-3 inline-flex items-center gap-2 rounded-full border
                border-border
              `,
              "bg-card/60 px-3 py-1 text-xs font-semibold tracking-[0.2em]",
              "text-primary uppercase",
            )}
          >
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
            Culture AI
          </p>
          <h1
            className={cn(
              "font-heading text-4xl font-bold tracking-tight text-foreground",
              "sm:text-5xl",
            )}
          >
            AI that fits how you move
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Private-by-default. Flow between{" "}
            <span className="font-medium text-foreground">chat</span>,{" "}
            <span className="font-medium text-foreground">project</span>, and{" "}
            <span className="font-medium text-foreground">companion</span>{" "}
            modes—one assistant that keeps context where you want it.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            Create an account and subscribe to Culture AI on its own, or unlock
            it with eligible monthly membership. Guests can try chat with
            limited free messages.
          </p>
          <div
            className={cn(
              "mt-10 flex flex-col items-center justify-center gap-3",
              "sm:flex-row sm:flex-wrap sm:gap-4",
            )}
          >
            <Button asChild size="lg">
              <Link href="/chat">Start chatting</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={cultureAiProductHref}>Culture AI subscription</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/membership">Membership (includes AI)</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className={`
        container mx-auto max-w-5xl px-4 py-16
        sm:py-20
      `}>
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className={cn(
              "font-heading text-3xl font-bold tracking-tight text-foreground",
            )}
          >
            Built for privacy, personality, and culture
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three capabilities that separate Culture AI from a generic chat box.
          </p>
        </div>
        <ul className={`
          mt-12 grid gap-6
          md:grid-cols-3
        `}>
          <li
            className={cn(
 "rounded-xl border border-border bg-card/70 p-6 ",
              `
                transition-shadow
 
              `,
            )}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Privacy
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Defaults that respect boundaries—your threads are for you and the
              experiences you opt into, not for open-ended harvesting.
            </p>
          </li>
          <li
            className={cn(
 "rounded-xl border border-border bg-card/70 p-6 ",
              `
                transition-shadow
 
              `,
            )}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Characters
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Personas that match how you plan—stylist, traveler, analyst, or
              calm copilot—without giving up capability.
            </p>
          </li>
          <li
            className={cn(
 "rounded-xl border border-border bg-card/70 p-6 ",
              `
                transition-shadow
 
              `,
            )}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Companion
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Memory-aware follow-ups when you are signed in—so recommendations
              and plans evolve instead of resetting every message.
            </p>
          </li>
        </ul>
      </section>

      <section
        className={cn(
          `
            border-y border-border bg-muted/20 px-4 py-16
            sm:py-20
          `,
        )}
      >
        <div className="container mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2
              className={cn(
                "font-heading text-3xl font-bold tracking-tight text-foreground",
              )}
            >
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
                    Grounded in our store & community context
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

      <section className={`
        container mx-auto max-w-5xl px-4 py-16
        sm:py-20
      `}>
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className={cn(
              "font-heading text-3xl font-bold tracking-tight text-foreground",
            )}
          >
            Culture AI subscription
          </h2>
          <p className="mt-3 text-muted-foreground">
            The prices below are for the{" "}
            <span className="text-foreground font-medium">
              standalone Culture AI subscription
            </span>{" "}
            product. You open the product page, choose monthly or annual billing
            there, add to cart, and check out—same as any other subscription
            item.{" "}
            <span className="text-foreground font-medium">
              Membership pricing is separate
            </span>{" "}
            (shipping, eSIM, staking perks) and is shown on the membership page.
          </p>
        </div>
        <div className={`
          mx-auto mt-10 grid max-w-5xl gap-6
          lg:grid-cols-2
        `}>
          <div
            className={cn(
              "flex flex-col rounded-xl border border-border bg-card/80 p-6",
 "",
            )}
          >
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Culture AI · billed monthly
            </h3>
            <p className="mt-4">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight text-foreground",
                )}
              >
                $12.99
              </span>
              <span className="text-muted-foreground">/month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Subscribe to Culture AI on its own. Use the product page to add the
              monthly plan to your cart and complete checkout.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href={cultureAiProductHref}>Open AI subscription product</Link>
            </Button>
          </div>
          <div
            className={cn(
              `
                relative flex flex-col rounded-xl border-2 border-primary
                bg-card
              `,
 "p-6 ",
            )}
          >
            <span
              className={cn(
                "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full",
                `
                  bg-primary px-3 py-0.5 text-xs font-semibold
                  text-primary-foreground
                `,
              )}
            >
              Best value
            </span>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Culture AI · billed annually
            </h3>
            <p className="mt-4">
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight text-foreground",
                )}
              >
                $9.99
              </span>
              <span className="text-muted-foreground">/month</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Effective rate when you pay annually (billed once per year on the
              product). Select the annual option on the product page, then add to
              cart.
            </p>
            <Button asChild className="mt-6 w-full">
              <Link href={cultureAiProductHref}>Open AI subscription product</Link>
            </Button>
          </div>
        </div>
        <div
          className={cn(
            "mx-auto mt-8 max-w-3xl rounded-xl border border-border bg-muted/20",
            "p-6 text-center",
          )}
        >
          <h3 className="font-heading text-lg font-semibold text-foreground">
            Membership (store perks)
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Membership tiers cover shipping discounts, eSIM benefits, staking
            perks, and more. Those prices are{" "}
            <span className="text-foreground font-medium">not</span> the $12.99 /
            $9.99 Culture AI subscription rates above. If Culture AI is bundled
            with your tier, you will see that on the membership page.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/membership">View membership pricing</Link>
          </Button>
        </div>
      </section>

      <section
        className={cn(
          `
            border-t border-border bg-muted/15 px-4 py-16
            sm:py-20
          `,
        )}
      >
        <div className="container mx-auto max-w-3xl">
          <h2
            className={cn(
              "font-heading text-center text-3xl font-bold tracking-tight",
              "text-foreground",
            )}
          >
            Frequently asked questions
          </h2>
          <div className="mt-10 space-y-3">
            {faqItems.map((item) => (
              <details
                className={cn(
 "group rounded-lg border border-border bg-card/80 ",
                  "open:bg-card",
                )}
                key={item.q}
              >
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between",
                    "gap-3 px-5 py-4 text-left font-semibold text-foreground",
                    `
                      marker:content-none
                      [&::-webkit-details-marker]:hidden
                    `,
                  )}
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      `
                        h-5 w-5 shrink-0 text-muted-foreground
                        transition-transform
                      `,
                      "group-open:rotate-180",
                    )}
                  />
                </summary>
                <p className={`
                  border-t border-border px-5 pt-0 pb-4 text-sm leading-relaxed
                  text-muted-foreground
                `}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Want the code story?{" "}
            <Link
              className={cn(
                "font-medium text-primary underline underline-offset-4",
                "hover:text-primary/90",
              )}
              href="/open-source"
            >
              Explore our open-source page
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-3xl px-4 pb-20 text-center">
        <h2 className="font-heading text-2xl font-bold text-foreground">
          Ready when you are
        </h2>
        <p className="mt-3 text-muted-foreground">
          Open chat, create an account, or pick the subscription path that fits.
        </p>
        <div
          className={cn(
            "mt-8 flex flex-col items-center justify-center gap-3",
            "sm:flex-row sm:gap-4",
          )}
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
