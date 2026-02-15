import Link from "next/link";

import { SEO_CONFIG } from "~/app";

export const metadata = {
  description: `Our cookies policy: we only use essential cookies. No trackers, no popups.`,
  title: `Cookies | ${SEO_CONFIG.name}`,
};

export default function CookiesPolicyPage() {
  return (
    <div
      className={`
      container mx-auto max-w-2xl px-4 py-12
      sm:py-16
    `}
    >
      <header className="mb-12 border-b border-border pb-10">
        <h1
          className={`
          text-3xl font-bold tracking-tight text-foreground
          sm:text-4xl
        `}
        >
          Cookies policy
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          No popups. No trackers. Just what we need to run the store.
        </p>
      </header>

      <div className="space-y-10">
        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            We only use essential cookies
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The only cookies we use are{" "}
            <strong className="font-medium text-foreground">
              essential cookies
            </strong>
            . They keep you signed in, remember your cart, and handle security
            and load balancing. No ads, no cross-site analytics, no third‑party
            trackers.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            No &quot;bad&quot; cookies — that&apos;s why there&apos;s no popup
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Many laws require sites to ask before using non‑essential or
            tracking cookies. We don&apos;t use those, so we don&apos;t ask.
            What you see is what you get: a site that works, without a cookie
            banner. We think that&apos;s how it should be.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            We don&apos;t follow you around the internet
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We don&apos;t use trackers that follow you from site to site. We
            don&apos;t sell your data to advertisers or hand it to data brokers.
            The cookies we set stay on our site and are used only to make your
            experience here work (e.g. session, cart, preferences).
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Summary
          </h2>
          <ul className="mt-3 space-y-2 text-muted-foreground" role="list">
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              Only essential cookies — nothing optional or creepy.
            </li>
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              No cookie popup because we don&apos;t use the kind that require
              one.
            </li>
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              No cross‑site trackers; we don&apos;t follow you around the web.
            </li>
          </ul>
        </section>

        <p className="pt-2 text-muted-foreground">
          Questions? Reach out on our{" "}
          <Link
            className={`
              font-medium text-primary underline-offset-4
              hover:underline
            `}
            href="/contact"
          >
            contact page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
