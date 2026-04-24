"use client";

import posthog from "posthog-js";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { ArrowRight, Users } from "lucide-react";

import { Button } from "~/ui/primitives/button";

/** PostHog multivariate flag — create in PostHog with keys: `control`, `commerce_first`, `story_first`. */
export const HOME_HERO_AB_FLAG = "home_hero_ab";

export type HomeHeroFeaturedTile = {
  href: string;
  image: string;
  name: string;
};

export type HomeHeroAbVariantKey = "commerce_first" | "control" | "story_first";

type HeroCopy = {
  h1Before: string;
  h1Highlight: string;
  pill: string;
  showLifestyleStrip: boolean;
  stripExplainer: string;
  sub: string;
};

const HERO_COPY: Record<HomeHeroAbVariantKey, HeroCopy> = {
  commerce_first: {
    h1Before: "Ship faster on the edit —",
    h1Highlight: "fewer clicks to checkout",
    pill: "Curated drops. Clear pricing.",
    showLifestyleStrip: true,
    stripExplainer:
      "Tap a product tile — every PDP is wired to conversion and attribution events we review weekly.",
    sub: "Same Culture quality with checkout, tracking, and payment options built for repeat buyers and token-aware shoppers.",
  },
  control: {
    h1Before: "The good life isn't loud — it's",
    h1Highlight: "lived on purpose",
    pill: "Real people. Real gear.",
    showLifestyleStrip: true,
    stripExplainer:
      "Real picks from the catalog — tap through to PDPs we measure end-to-end with checkout and attribution.",
    sub: "Curated tech, apparel, and wellness for people who do the work — and want fewer regrets, better sleep, and more room to move.",
  },
  story_first: {
    h1Before: "Gear that earns a spot in",
    h1Highlight: "real routines",
    pill: "Built from member feedback.",
    showLifestyleStrip: false,
    stripExplainer: "",
    sub: "Reviews and fulfillment transparency first — then catalog depth across apparel, longevity, and hardware.",
  },
};

function normalizeVariantKey(value: unknown): HomeHeroAbVariantKey {
  if (value === "commerce_first" || value === "story_first") return value;
  return "control";
}

function captureSafe(
  event: string,
  props: Record<string, string | boolean>,
): void {
  try {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;
    posthog.capture(event, props);
  } catch {
    // ignore
  }
}

function HomeHeroLifestyleStripInner({
  tiles,
  variant,
}: Readonly<{
  tiles: readonly HomeHeroFeaturedTile[];
  variant: HomeHeroAbVariantKey;
}>): React.ReactElement | null {
  if (tiles.length === 0) return null;

  return (
    <div
      className={`
        mx-auto mt-12 grid w-full max-w-4xl grid-cols-2 gap-3
        sm:grid-cols-4 sm:gap-4
      `}
    >
      {tiles.map((t) => (
        <Link
          className={`
            group relative aspect-[3/4] overflow-hidden rounded-xl border
            border-border/80 bg-muted/40 shadow-sm
            transition hover:border-primary/40 hover:shadow-md
          `}
          href={t.href}
          key={t.href}
          onClick={() =>
            captureSafe("home_hero_lifestyle_click", {
              hero_variant: variant,
              href: t.href,
              name: t.name,
            })
          }
        >
          <Image
            alt=""
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            src={t.image}
          />
          <span
            className={`
              absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70
              to-transparent px-2 py-3 text-center text-xs font-medium
              text-white
              sm:text-sm
            `}
          >
            {t.name}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function HomeHeroAbSection({
  children,
  tiles,
}: Readonly<{
  children: React.ReactNode;
  tiles: readonly HomeHeroFeaturedTile[];
}>): React.ReactElement {
  const [variant, setVariant] = React.useState<HomeHeroAbVariantKey>("control");
  const viewFired = React.useRef(false);
  const assignedFired = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const applyFlags = () => {
      const raw = posthog.getFeatureFlag(HOME_HERO_AB_FLAG);
      const next = normalizeVariantKey(
        raw === false || raw === undefined || raw === null ? "control" : raw,
      );
      setVariant(next);
      if (!posthog.__loaded) return;
      if (
        raw !== false &&
        raw !== undefined &&
        raw !== null &&
        !assignedFired.current
      ) {
        assignedFired.current = true;
        captureSafe("home_hero_variant_assigned", { variant: next });
      }
      if (!viewFired.current) {
        viewFired.current = true;
        captureSafe("home_above_fold_view", {
          hero_variant: next,
          surface: "home_hero",
        });
      }
    };

    const unsub = posthog.onFeatureFlags(applyFlags);
    posthog.reloadFeatureFlags();
    let n = 0;
    const poll = window.setInterval(() => {
      n += 1;
      applyFlags();
      if (viewFired.current && n > 30) window.clearInterval(poll);
    }, 80);
    return () => {
      window.clearInterval(poll);
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const copy = HERO_COPY[variant];

  return (
    <div className="mx-auto w-full max-w-4xl text-center">
      <div
        className={`
          mb-6 inline-flex items-center gap-2 rounded-full border border-border
          bg-card/80 px-4 py-1.5 text-sm font-medium tracking-[0.15em]
          text-muted-foreground uppercase backdrop-blur-sm
          dark:border-border dark:bg-card/80
        `}
      >
        <Users className="h-3 w-3 text-primary" aria-hidden />
        {copy.pill}
      </div>
      <h1
        className={`
          font-heading-lcp text-4xl leading-tight font-extrabold tracking-tight
          text-foreground
          sm:text-5xl
          md:text-6xl
          lg:leading-[1.08]
        `}
      >
        {copy.h1Before}{" "}
        <span className="text-gradient-brand">{copy.h1Highlight}</span>
      </h1>
      <p
        className={`
          mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground
          md:text-xl
        `}
      >
        {copy.sub}
      </p>
      {children}
      {copy.stripExplainer.trim() ? (
        <p
          className={`
            mx-auto mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground
            md:text-base
          `}
        >
          {copy.stripExplainer}
        </p>
      ) : null}
      {copy.showLifestyleStrip ? (
        <HomeHeroLifestyleStripInner tiles={tiles} variant={variant} />
      ) : null}
      <div
        className={`
          mt-10 flex flex-col items-center justify-center gap-4
          sm:flex-row
        `}
      >
        <Link
          href="/products"
          onClick={() =>
            captureSafe("home_hero_cta_click", {
              cta_id: "shop_edit",
              hero_variant: variant,
              href: "/products",
            })
          }
        >
          <Button
            className="h-12 gap-2 px-8 text-sm tracking-wider uppercase"
            size="lg"
          >
            Shop the edit <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link
          href="/about"
          onClick={() =>
            captureSafe("home_hero_cta_click", {
              cta_id: "why_exist",
              hero_variant: variant,
              href: "/about",
            })
          }
        >
          <Button
            className="h-12 px-8 text-sm tracking-wider uppercase"
            size="lg"
            variant="outline"
          >
            Why we exist
          </Button>
        </Link>
      </div>
    </div>
  );
}
