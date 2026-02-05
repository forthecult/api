"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";

export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const handleOpen = () => {
    setQuery("");
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setOpen(false);
    if (q) {
      router.push(`/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleOpen}
        aria-label="Search products"
      >
        <Search className="h-5 w-5" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogTitle className="sr-only">Search products</DialogTitle>
          <form onSubmit={handleSubmit} className="flex flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                autoFocus
                aria-label="Search"
              />
            </div>
            <div className="flex justify-end gap-2 px-3 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Search
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
