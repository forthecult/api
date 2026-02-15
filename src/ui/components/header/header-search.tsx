"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "~/ui/primitives/button";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";
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
      router.push(`/products?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  return (
    <>
      <Button
        aria-label="Search products"
        className={`
          text-[#1A1611]
          dark:text-[#F5F1EB]
        `}
        onClick={handleOpen}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Search aria-hidden className="h-5 w-5" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          className={`
          gap-0 overflow-hidden p-0
          sm:max-w-md
        `}
        >
          <DialogTitle className="sr-only">Search products</DialogTitle>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search
                aria-hidden
                className="h-5 w-5 shrink-0 text-muted-foreground"
              />
              <Input
                aria-label="Search"
                autoFocus
                className={`
                  border-0 bg-transparent shadow-none
                  focus-visible:ring-0
                `}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products..."
                type="text"
                value={query}
              />
            </div>
            <div className="flex justify-end gap-2 px-3 py-3">
              <Button
                onClick={() => setOpen(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Search
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
