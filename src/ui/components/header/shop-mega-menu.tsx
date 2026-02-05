"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { cn } from "~/lib/cn";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
  subcategories?: Array<{ id: string; name: string; productCount?: number }>;
};

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary",
            isActive ? "font-semibold text-primary" : "text-muted-foreground",
            className,
          )}
          aria-expanded={open}
          aria-haspopup="true"
        >
          Shop
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[min(95vw,960px)] max-h-[min(80vh,520px)] overflow-auto rounded-xl border bg-popover p-0 shadow-lg"
      >
        <div className="flex flex-row flex-wrap gap-x-8 gap-y-4 py-4 px-4">
          <div className="shrink-0">
            <Link
              href="/products"
              className="block rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => setOpen(false)}
            >
              All products
            </Link>
          </div>
          {categories.map((cat) => {
            const href = cat.slug ? `/${cat.slug}` : "/products";
            return (
              <div
                key={cat.id}
                className="flex min-w-[160px] max-w-[200px] flex-col shrink-0"
              >
                <Link
                  href={href}
                  className="rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setOpen(false)}
                >
                  {cat.name}
                </Link>
                {cat.subcategories && cat.subcategories.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-0">
                    {cat.subcategories.map((sub) => (
                      <li key={sub.id}>
                        <Link
                          href={href}
                          className="block rounded px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          onClick={() => setOpen(false)}
                        >
                          {sub.name}
                          {sub.productCount != null && sub.productCount > 0 && (
                            <span className="ml-1 tabular-nums">
                              ({sub.productCount})
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
