import type { Metadata } from "next";
import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { Button } from "~/ui/primitives/button";

export const metadata: Metadata = {
  title: `Affiliate Program | ${SEO_CONFIG.name}`,
  description:
    "Partner with Culture. Earn by sharing products that protect health, privacy, and autonomy. Premium lifestyle brand since 2015. Apply to join our affiliate program.",
  openGraph: {
    title: `Affiliate Program | ${SEO_CONFIG.name}`,
    description:
      "Earn by sharing Culture. Premium products, 90-day cookie, payouts in PayPal or crypto (BTC, stablecoins, CULT). Join our affiliate program.",
    type: "website",
  },
};

export default function AffiliateProgramPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/50 via-muted/20 to-background">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, var(--primary) 0%, transparent 50%), radial-gradient(circle at 70% 80%, var(--primary) 0%, transparent 40%)`,
          }}
        />
        <div className="container relative mx-auto max-w-4xl px-4 py-20 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Partner with us
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
            Share what you believe in.
            <br />
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Earn with Culture.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            We're a lifestyle brand built on decentralization—premium products
            that protect health, privacy, and autonomy. If that's what you stand
            for too, join our affiliate program. Apply once, get a unique link,
            and earn when your audience shops.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/dashboard/affiliate">Apply to join</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/about">Why Culture?</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section className="border-b border-border py-16 sm:py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Simple, transparent, built for creators and publishers who care what
            they promote.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <div className="group rounded-2xl border border-border bg-card/50 p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-2 ring-primary/20">
                1
              </span>
              <h3 className="mt-4 font-semibold text-foreground">Apply</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Create an account, apply from your dashboard. We review
                applications and approve partners who align with our values.
              </p>
            </div>
            <div className="group rounded-2xl border border-border bg-card/50 p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-2 ring-primary/20">
                2
              </span>
              <h3 className="mt-4 font-semibold text-foreground">Share</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use your unique referral link. Share it anywhere—social, blog,
                newsletter. When someone clicks, we remember them for 90 days.
              </p>
            </div>
            <div className="group rounded-2xl border border-border bg-card/50 p-6 text-center shadow-sm transition-shadow hover:shadow-md">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-2 ring-primary/20">
                3
              </span>
              <h3 className="mt-4 font-semibold text-foreground">Earn</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                When they buy, you earn a commission. Configurable per partner.
                Payouts in Bitcoin, stablecoins, CULT, or PayPal when you
                &apos;re ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Culture — ethos */}
      <section className="border-b border-border bg-muted/20 py-16 sm:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            What you&apos;re promoting
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Not just another store. A brand that stands for something.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Culture has been here since 2015. We sell premium products that
            protect your health, privacy, assets, and autonomy—natural fiber
            apparel, clean water, hardware wallets, gear that lasts. We
            don&apos;t do polyester, data selling, or planned obsolescence.
            Every product passes the Culture test: Does it improve
            someone&apos;s life? Would we use it ourselves?
          </p>
          <ul className="mt-8 space-y-4">
            {[
              "Curated for intentional consumers who research before they buy.",
              "Crypto-native: 50+ coins, self-custody options, no intermediary holding funds.",
              "Privacy-first: no mandatory sign-up, no third-party trackers, data delete on request.",
              "Quality over quantity. We'd rather carry less and stand behind every item.",
            ].map((item, i) => (
              <li key={i} className="flex gap-3 text-muted-foreground">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <Button asChild variant="outline" size="sm">
              <Link href="/about">Read our story</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Program details */}
      <section className="border-b border-border py-16 sm:py-20">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Program details
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/50 px-5 py-5">
              <h3 className="font-semibold text-foreground">
                Cookie & attribution
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                90-day cookie. If someone clicks your link and buys within 90
                days, you get the commission. One referral can lead to multiple
                orders in that window.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/50 px-5 py-5 shadow-sm">
              <h3 className="font-semibold text-foreground">Payouts</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Bitcoin, stablecoins (e.g. USDT), or PayPal. We process payouts
                manually at first; higher-volume partners can discuss frequency.
                You're promoting a crypto-native brand—we pay like one.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/50 px-5 py-5 shadow-sm">
              <h3 className="font-semibold text-foreground">Commission</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Percentage or fixed amount per sale, set when you're approved.
                Optional customer discount per affiliate so you can offer your
                audience something extra.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/50 px-5 py-5 shadow-sm">
              <h3 className="font-semibold text-foreground">Who can join</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Anyone can apply. We approve based on fit—audience, values, how
                you plan to promote. No minimum follower count. Blog, YouTube,
                X, Telegram, newsletter—if you share Culture with your people,
                we want to hear from you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick facts */}
      <section className="border-b border-border bg-muted/20 py-12">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center text-lg font-semibold text-foreground">
            Quick facts
          </h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center shadow-sm">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cookie
              </dt>
              <dd className="mt-1 font-semibold text-foreground">90 days</dd>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center shadow-sm">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Payout options
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                BTC, stablecoins, CULT, PayPal
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center shadow-sm">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Sign up
              </dt>
              <dd className="mt-1 font-semibold text-foreground">Free</dd>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-center shadow-sm">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Where to promote
              </dt>
              <dd className="mt-1 font-semibold text-foreground">
                Anywhere, global
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <ul className="mt-8 space-y-8">
            <li>
              <h3 className="font-semibold text-foreground">
                What is the Culture affiliate program?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                A free partnership where you earn commission by promoting
                Culture. You get a unique link, share it, and when someone buys
                through that link (within 90 days), you get paid. You also get a
                dashboard to track clicks, conversions, and earnings.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-foreground">
                How do I get paid?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                We support Bitcoin, stablecoins (e.g. USDT on ERC-20 or TRC-20),
                CULT, and PayPal. You choose your preferred method when you
                apply or in your affiliate dashboard. Payouts are processed
                manually; minimum thresholds may apply.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-foreground">
                Do I need a big audience?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No. We care about fit—whether you run a blog, a YouTube channel,
                a Telegram group, or a newsletter. If your audience cares about
                quality, privacy, or crypto, you're a good candidate. Apply and
                tell us how you'd promote Culture.
              </p>
            </li>
            <li>
              <h3 className="font-semibold text-foreground">
                Can I offer my audience a discount?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Optional. When you're approved, we can configure a customer
                discount for your link (percent or fixed amount). Your audience
                gets a benefit; you still earn commission on the sale.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary/5 py-16 sm:py-20">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Ready to partner?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Apply from your dashboard. If you don't have an account yet, sign up
            first—then go to Affiliate and submit your application.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <Link href="/dashboard/affiliate">Apply to join</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
