"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Input } from "~/ui/primitives/input";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/products?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  return (
    <form
      className={`
        flex h-9 max-w-[min(100vw-12rem,16rem)] min-w-[10rem] items-center gap-2
        rounded-full border border-border bg-muted/40 px-3
        transition-colors
        focus-within:border-primary/50 focus-within:bg-muted/60
      `}
      onSubmit={handleSubmit}
    >
      <Search
        aria-hidden
        className={`
          h-4 w-4 shrink-0 text-[#1A1611]
          dark:text-[#F5F1EB]
        `}
      />
      <Input
        aria-label="Search products"
        className={`
          h-7 min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none
          placeholder:text-muted-foreground
          focus-visible:ring-0
        `}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
        type="search"
        value={query}
      />
    </form>
  );
}
