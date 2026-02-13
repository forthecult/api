"use client";

import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Home,
  ShoppingBag,
  Shirt,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useMemo } from "react";

import { sortSubcategories } from "~/lib/category-sort";
import { cn } from "~/lib/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SubcategoryItem = {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
};

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
  subcategories?: SubcategoryItem[];
};

/* ------------------------------------------------------------------ */
/*  Section definitions – map categories into organised columns        */
/* ------------------------------------------------------------------ */

type SectionDef = {
  label: string;
  icon: React.ReactNode;
  /** Category slugs that belong in this section (order matters). */
  categorySlugs: string[];
};

const SECTION_DEFS: SectionDef[] = [
  {
    label: "Tech & Smart Home",
                    icon: <Cpu className="h-5 w-5" />,
    categorySlugs: ["smart-home", "ai", "hardware-wallets", "iot", "esim"],
  },
  {
    label: "Clothing & Shoes",
    icon: <Shirt className="h-5 w-5" />,
    categorySlugs: [
      "mens-clothing",
      "womens-clothing",
      "childrens-clothing",
      "sandals",
      "shoes",
    ],
  },
  {
    label: "Accessories",
    icon: <ShoppingBag className="h-5 w-5" />,
    categorySlugs: ["accessories"],
  },
  {
    label: "Home & Culture",
    icon: <Home className="h-5 w-5" />,
    categorySlugs: ["meme-novelty", "home-living", "health-wellness"],
  },
];

/** Max subcategories shown per category before collapsing to "View all". */
const MAX_SUBS = 6;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShopMegaMenu({
  categories,
  isActive,
  className,
}: {
  categories: CategoryItem[];
  isActive: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  /* Map slug → category for fast lookup */
  const catBySlug = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    for (const cat of categories) {
      if (cat.slug) map.set(cat.slug, cat);
    }
    return map;
  }, [categories]);

  /* Build organised sections from the definitions + data */
  const sections = useMemo(() => {
    const assignedSlugs = new Set<string>();

    const built = SECTION_DEFS.map((def) => {
      const sectionCats: CategoryItem[] = [];
      for (const slug of def.categorySlugs) {
        const cat = catBySlug.get(slug);
        if (cat) {
          sectionCats.push(cat);
          assignedSlugs.add(slug);
        }
      }
      return { ...def, categories: sectionCats };
    }).filter((s) => s.categories.length > 0);

    /* If any category didn't map, append to last section */
    const unassigned = categories.filter(
      (c) => c.slug && !assignedSlugs.has(c.slug),
    );
    if (unassigned.length > 0 && built.length > 0) {
      built[built.length - 1].categories.push(...unassigned);
    }

    return built;
  }, [categories, catBySlug]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-lg font-medium transition-colors",
            "hover:text-primary dark:hover:text-[#9945FF] dark:border-b-2 dark:border-transparent dark:hover:border-[#9945FF]",
            isActive
              ? "font-semibold text-primary dark:text-[#9945FF] dark:border-[#9945FF]"
              : "text-muted-foreground",
            className,
          )}
          aria-expanded={open}
          aria-haspopup="true"
        >
          Shop
          <ChevronDown
            className={cn(
              "h-5 w-5 transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[min(95vw,1060px)] rounded-xl border bg-popover p-0 shadow-xl"
      >
        {/* ── Category grid ── */}
        <div
          className="grid gap-0 divide-x"
          style={{
            gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
          }}
        >
          {sections.map((section) => (
            <div key={section.label} className="px-5 pb-5 pt-4">
              {/* Section header */}
              <div className="mb-3 flex items-center gap-1.5 text-base font-bold uppercase tracking-widest text-muted-foreground/70">
                {section.icon}
                {section.label}
              </div>

              {/* Categories */}
              <div className="space-y-3">
                {section.categories.map((cat) => {
                  const href = cat.slug ? `/${cat.slug}` : "/products";
                  const subs = sortSubcategories(
                    (cat.subcategories ?? [])
                      .filter((s) => (s.productCount ?? 0) > 0)
                      .map((s) => ({ ...s, slug: s.slug ?? "" })),
                  );
                  const visibleSubs = subs.slice(0, MAX_SUBS);
                  const hasMore = subs.length > MAX_SUBS;

                  return (
                    <div key={cat.id}>
                      <Link
                        href={href}
                        className="group inline-flex items-center gap-1 text-lg font-semibold leading-snug transition-colors hover:text-primary"
                        onClick={() => setOpen(false)}
                      >
                        {cat.name}
                        <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>

                      {visibleSubs.length > 0 && (
                        <ul className="mt-1 space-y-px">
                          {visibleSubs.map((sub) => {
                            // Clean path /sub-slug (e.g. /troll) for SEO; fallback to parent category when no sub slug
                            const subHref = sub.slug ? `/${sub.slug}` : href;
                            return (
                              <li key={sub.id}>
                                <Link
                                  href={subHref}
                                  className="block rounded-md px-2 py-1.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  onClick={() => setOpen(false)}
                                >
                                  {sub.name}
                                  {(sub.productCount ?? 0) > 0 && (
                                    <span className="ml-1 text-sm tabular-nums opacity-40">
                                      ({sub.productCount})
                                    </span>
                                  )}
                                </Link>
                              </li>
                            );
                          })}
                          {hasMore && (
                            <li>
                              <Link
                                href={href}
                                className="inline-flex items-center gap-0.5 px-2 py-1.5 text-base font-medium text-primary transition-colors hover:underline"
                                onClick={() => setOpen(false)}
                              >
                                View all
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom CTA bar ── */}
        <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-2.5">
          <Link
            href="/products"
            className="group inline-flex items-center gap-2 text-lg font-semibold text-primary transition-colors hover:text-primary/80"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="h-5 w-5" />
            Browse All Products
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <span className="hidden text-base text-muted-foreground sm:inline">
            Free worldwide shipping for CULT Members
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
