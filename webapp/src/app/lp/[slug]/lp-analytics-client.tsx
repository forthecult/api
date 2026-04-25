"use client";

import posthog from "posthog-js";
import Link from "next/link";
import * as React from "react";

import { Button } from "~/ui/primitives/button";

export function LpViewCapture({ slug }: { slug: string }): null {
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (fired.current) return;
    if (typeof window === "undefined") return;
    const fire = () => {
      if (fired.current) return;
      if (!posthog.__loaded) return;
      fired.current = true;
      try {
        posthog.capture("lp_view", { lp_slug: slug });
      } catch {
        // ignore
      }
    };
    fire();
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      fire();
      if (fired.current || n > 30) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [slug]);
  return null;
}

export function LpPrimaryCta({
  children,
  className,
  href,
  slug,
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  slug: string;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild className={className} size="lg" variant={variant}>
      <Link
        href={href}
        onClick={() => {
          try {
            if (posthog.__loaded) {
              posthog.capture("lp_cta_click", {
                cta: "primary",
                lp_slug: slug,
              });
            }
          } catch {
            // ignore
          }
        }}
      >
        {children}
      </Link>
    </Button>
  );
}

export function LpSecondaryCta({
  children,
  className,
  href,
  slug,
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
  slug: string;
}) {
  return (
    <Button asChild className={className} size="lg" variant="outline">
      <Link
        href={href}
        onClick={() => {
          try {
            if (posthog.__loaded) {
              posthog.capture("lp_cta_click", {
                cta: "secondary",
                lp_slug: slug,
              });
            }
          } catch {
            // ignore
          }
        }}
      >
        {children}
      </Link>
    </Button>
  );
}
