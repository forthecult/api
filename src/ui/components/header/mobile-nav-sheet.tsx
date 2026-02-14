"use client";

import {
  ChevronRight,
  Heart,
  Moon,
  Package,
  Search,
  Smartphone,
  Sun,
  UserIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";

import { SEO_CONFIG } from "~/app";
import { cn } from "~/lib/cn";
import { countryFlag } from "~/lib/country-flag";
import { Cart } from "~/ui/components/cart";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  CURRENCY_OPTIONS,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import {
  Sheet,
  SheetClose,
  SheetContent,
} from "~/ui/primitives/sheet";

// Lazy load FooterPreferencesModal - only needed when user opens preferences
const FooterPreferencesModal = dynamic(
  () =>
    import("~/ui/components/footer/FooterPreferencesModal").then(
      (mod) => mod.FooterPreferencesModal,
    ),
  { ssr: false },
);

type CategoryItem = {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
  subcategories?: Array<{ id: string; name: string; productCount?: number }>;
};

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  pathname: string;
  user: { email: string; image?: string | null; name: string } | null | undefined;
  authPending: boolean;
  isAdmin: boolean;
  showAuth: boolean;
  isShopActive: boolean;
}

export function MobileNavSheet({
  open,
  onOpenChange,
  categories,
  pathname,
  user,
  authPending,
  isAdmin,
  showAuth,
  isShopActive,
}: MobileNavSheetProps) {
  // Alias for backward compatibility
  const authUser = user;
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [shopExpanded, setShopExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [prefsOpen, setPrefsOpen] = React.useState(false);

  const { currency, selectedCountry } = useCountryCurrency();
  const currentCountry = mounted
    ? COUNTRY_OPTIONS_ALPHABETICAL.find((o) => o.code === selectedCountry)
    : null;
  const currentCurrencyOption = mounted
    ? CURRENCY_OPTIONS.find((o) => o.code === currency)
    : null;
  const localeLabel =
    mounted && currentCountry && currentCurrencyOption
      ? `${currentCountry.countryName} • ${currentCurrencyOption.code}`
      : "United States • USD";

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    onOpenChange(false);
    if (q) {
      router.push(`/products?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          hideClose
          className="flex w-[min(85vw,320px)] flex-col gap-0 overflow-hidden p-0"
        >
          {/* Header: Close, Culture, User, Cart */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <SheetClose asChild>
                <Button aria-label="Close menu" size="icon" variant="ghost">
                  <span className="text-lg font-bold">×</span>
                </Button>
              </SheetClose>
              <Link
                className="font-heading text-sm font-bold tracking-[0.2em] uppercase text-[#F5F1EB]"
                href="/"
                onClick={() => onOpenChange(false)}
              >
                {SEO_CONFIG.name}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              {showAuth && (authUser || !authPending) && (
                <>
                  {authUser ? (
                    <Button asChild size="icon" variant="ghost">
                      <Link
                        href="/dashboard"
                        onClick={() => onOpenChange(false)}
                        aria-label="Account"
                      >
                        <UserIcon className="h-5 w-5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild size="icon" variant="ghost">
                      <Link
                        href="/login"
                        onClick={() => onOpenChange(false)}
                        aria-label="Log in"
                      >
                        <UserIcon className="h-5 w-5" />
                      </Link>
                    </Button>
                  )}
                </>
              )}
              <div className="[&_.border-rounded]:rounded-full">
                <Cart />
              </div>
            </div>
          </div>

          {/* Always-visible search */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
          >
            <Search className="h-4 w-4 shrink-0 text-[#1A1611] dark:text-[#F5F1EB]" />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              aria-label="Search"
            />
          </form>

          {/* Token status (if logged in) */}
          {authUser && !authPending && (
            <div className="shrink-0 border-b px-4 py-2 text-sm text-muted-foreground">
              <span aria-hidden>💎</span> Member
            </div>
          )}

          {/* Main nav */}
          <nav className="flex-1 overflow-y-auto py-2">
            {/* Shop expandable */}
            <div className="px-2">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-base font-medium",
                  isShopActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/50",
                )}
                onClick={() => setShopExpanded((e) => !e)}
                aria-expanded={shopExpanded}
              >
                Shop
                <ChevronRight
                  className={cn("h-4 w-4 transition-transform", shopExpanded && "rotate-90")}
                  aria-hidden
                />
              </button>
              {shopExpanded && (
                <ul className="ml-2 mt-1 space-y-0.5 border-l border-muted pl-3">
                  {categories.map((cat) => {
                    const href = cat.slug ? `/${cat.slug}` : "/products";
                    return (
                      <li key={cat.id}>
                        <Link
                          className={cn(
                            "block rounded px-2 py-1.5 text-sm",
                            pathname === href
                              ? "font-medium text-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          href={href}
                          onClick={() => onOpenChange(false)}
                        >
                          {cat.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Membership link hidden until launch */}
            <Link
              className={cn(
                "block rounded-md px-4 py-2 text-base font-medium",
                pathname?.startsWith("/esim")
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/50",
              )}
              href="/esim"
              onClick={() => onOpenChange(false)}
            >
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                eSIM
              </span>
            </Link>
            <Link
              className={cn(
                "block rounded-md px-4 py-2 text-base font-medium",
                pathname === "/about"
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/50",
              )}
              href="/about"
              onClick={() => onOpenChange(false)}
            >
              About
            </Link>
            <Link
              className={cn(
                "block rounded-md px-4 py-2 text-base font-medium",
                pathname === "/contact"
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/50",
              )}
              href="/contact"
              onClick={() => onOpenChange(false)}
            >
              Contact
            </Link>

            {/* Divider */}
            <div className="my-2 border-t" />

            {/* Account links */}
            {showAuth && (
              <>
                <Link
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium text-foreground hover:bg-muted/50"
                  href="/dashboard"
                  onClick={() => onOpenChange(false)}
                >
                  <UserIcon className="h-4 w-4" />
                  Account
                </Link>
                <Link
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium text-foreground hover:bg-muted/50"
                  href="/dashboard/orders"
                  onClick={() => onOpenChange(false)}
                >
                  <Package className="h-4 w-4" />
                  Orders
                </Link>
                <Link
                  className="flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium text-foreground hover:bg-muted/50"
                  href="/dashboard/wishlist"
                  onClick={() => onOpenChange(false)}
                >
                  <Heart className="h-4 w-4" />
                  Wishlist
                </Link>
                {isAdmin && (
                  <a
                    className="flex items-center gap-2 rounded-md px-4 py-2 text-base font-medium text-foreground hover:bg-muted/50"
                    href={
                      typeof process.env.NEXT_PUBLIC_ADMIN_APP_URL === "string"
                        ? process.env.NEXT_PUBLIC_ADMIN_APP_URL
                        : "http://localhost:3001"
                    }
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={() => onOpenChange(false)}
                  >
                    Admin
                  </a>
                )}
              </>
            )}

            {/* Divider */}
            <div className="my-2 border-t" />

            {/* Country / currency */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-base font-medium text-foreground hover:bg-muted/50"
              onClick={() => setPrefsOpen(true)}
              aria-label="Country and currency"
            >
              <span aria-hidden>{countryFlag(selectedCountry)}</span>
              {localeLabel}
            </button>

            {/* Theme */}
            {mounted && (
              <div className="px-4 py-2">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Theme
                </span>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant={theme === "light" ? "secondary" : "ghost"}
                    className="flex-1 min-w-0"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="mr-1 h-3.5 w-3.5 shrink-0" />
                    Light
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === "dark" ? "secondary" : "ghost"}
                    className="flex-1 min-w-0"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="mr-1 h-3.5 w-3.5 shrink-0" />
                    Dark
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === "system" || !theme ? "secondary" : "ghost"}
                    className="flex-1 min-w-0"
                    onClick={() => setTheme("system")}
                  >
                    <svg
                      aria-hidden
                      className="mr-1 h-3.5 w-3.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        clipRule="evenodd"
                        d="M3.5 2A1.5 1.5 0 002 3.5V15a3 3 0 003 3h12a1.5 1.5 0 001.5-1.5V3.5A1.5 1.5 0 0017 2H3.5zM5 5.75c0-.41.334-.75.75-.75h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.75-.75zM5.75 8.25a.75.75 0 00-.75.75v3.25c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75V9a.75.75 0 00-.75-.75h-8.5z"
                        fillRule="evenodd"
                      />
                    </svg>
                    System
                  </Button>
                </div>
              </div>
            )}
          </nav>
        </SheetContent>
      </Sheet>
      <FooterPreferencesModal open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
}
