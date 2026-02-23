"use client";

import {
  ArrowRight,
  ChevronDown,
  Cpu,
  Home,
  Shirt,
  ShoppingBag,
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

interface CategoryItem {
  id: string;
  name: string;
  productCount?: number;
  slug?: string;
  subcategories?: SubcategoryItem[];
}

interface SectionDef {
  /** Category slugs that belong in this section (order matters). */
  categorySlugs: string[];
  icon: React.ReactNode;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Section definitions – map categories into organised columns        */
/* ------------------------------------------------------------------ */

interface SubcategoryItem {
  id: string;
  name: string;
  productCount?: number;
  slug?: string;
}

const SECTION_DEFS: SectionDef[] = [
  {
    categorySlugs: ["smart-home", "ai", "hardware-wallets", "iot", "esim"],
    icon: <Cpu className="h-5 w-5" />,
    label: "Tech & Smart Home",
  },
  {
    categorySlugs: [
      "mens-clothing",
      "womens-clothing",
      "childrens-clothing",
      "sandals",
      "shoes",
    ],
    icon: <Shirt className="h-5 w-5" />,
    label: "Clothing & Shoes",
  },
  {
    categorySlugs: ["accessories"],
    icon: <ShoppingBag className="h-5 w-5" />,
    label: "Accessories",
  },
  {
    categorySlugs: ["meme-novelty", "home-living", "health-wellness"],
    icon: <Home className="h-5 w-5" />,
    label: "Home & Culture",
  },
];

/** Max subcategories shown per category before collapsing to "View all". */
const MAX_SUBS = 6;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShopMegaMenu({
  categories,
  className,
  initialOpen = false,
  isActive,
}: {
  categories: CategoryItem[];
  className?: string;
  /** When true (e.g. user hovered to load), open the popover immediately so it doesn’t flash closed. */
  initialOpen?: boolean;
  isActive: boolean;
}) {
  const [open, setOpen] = React.useState(initialOpen);

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
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="true"
          className={cn(
            `
              accent-underline inline-flex items-center gap-1 rounded-md
              bg-transparent py-1.5 text-base font-medium tracking-wider
              transition-colors
              hover:text-[#C4873A]
            `,
            isActive ? "font-semibold text-[#C4873A]" : "text-[#8A857E]",
            className,
          )}
          type="button"
        >
          Shop
          <ChevronDown
            aria-hidden
            className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={`
          w-[min(95vw,1060px)] rounded-lg border border-[#2A2A2A] bg-[#1A1A1A]
          p-0 shadow-xl
        `}
        sideOffset={4}
      >
        {/* ── Category grid ── */}
        <div
          className="grid gap-0 divide-x"
          style={{
            gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
          }}
        >
          {sections.map((section) => (
            <div className="px-5 pt-4 pb-5" key={section.label}>
              {/* Section header */}
              <div
                className={`
                mb-3 flex items-center gap-1.5 text-sm font-bold
                tracking-[0.15em] text-[#C4873A] uppercase
              `}
              >
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
                        className={`
                          group inline-flex items-center gap-1 text-base
                          leading-snug font-semibold text-[#F5F1EB]
                          transition-colors
                          hover:text-[#C4873A]
                        `}
                        href={href}
                        onClick={() => setOpen(false)}
                      >
                        {cat.name}
                        <ArrowRight
                          className={`
                          h-4 w-4 opacity-0 transition-opacity
                          group-hover:opacity-100
                        `}
                        />
                      </Link>

                      {visibleSubs.length > 0 && (
                        <ul className="mt-1 space-y-px">
                          {visibleSubs.map((sub) => {
                            // Clean path /sub-slug (e.g. /troll) for SEO; fallback to parent category when no sub slug
                            const subHref = sub.slug ? `/${sub.slug}` : href;
                            return (
                              <li key={sub.id}>
                                <Link
                                  className={`
                                    block rounded-md px-2 py-1.5 text-sm
                                    text-[#8A857E] transition-colors
                                    hover:bg-[#2A2A2A] hover:text-[#F5F1EB]
                                  `}
                                  href={subHref}
                                  onClick={() => setOpen(false)}
                                >
                                  {sub.name}
                                  {(sub.productCount ?? 0) > 0 && (
                                    <span
                                      className={`
                                      ml-1 text-sm tabular-nums opacity-40
                                    `}
                                    >
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
                                className={`
                                  inline-flex items-center gap-0.5 px-2 py-1.5
                                  text-sm font-medium text-[#C4873A]
                                  transition-colors
                                  hover:underline
                                `}
                                href={href}
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
        <div
          className={`
          flex items-center justify-between border-t border-[#2A2A2A]
          bg-[#111111] px-5 py-2.5
        `}
        >
          <Link
            className={`
              group inline-flex items-center gap-2 text-sm font-semibold
              text-[#C4873A] transition-colors
              hover:text-[#D4A05A]
            `}
            href="/products"
            onClick={() => setOpen(false)}
          >
            <Sparkles className="h-4 w-4" />
            Browse All Products
            <ArrowRight
              className={`
              h-4 w-4 transition-transform
              group-hover:translate-x-0.5
            `}
            />
          </Link>
          <span
            className={`
            hidden text-xs tracking-wider text-[#8A857E] uppercase
            sm:inline
          `}
          >
            Free worldwide shipping for CULT Members
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
