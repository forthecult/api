"use client";

import { Menu, Search, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SEO_CONFIG } from "~/app";
import { listUserAccounts, useCurrentUser } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { NOTIFICATION_PREFS_UPDATED } from "~/lib/events";
import {
  CRYPTO_CATEGORY_NAMES_SET,
  SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG,
} from "~/lib/storefront-categories";
import { Cart } from "~/ui/components/cart";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Skeleton } from "~/ui/primitives/skeleton";

import { NotificationsWidget } from "../notifications/notifications-widget";
import { HeaderGuestDropdown } from "./header-guest-dropdown";
import { HeaderSearch } from "./header-search";
import { HeaderUserDropdown } from "./header-user";
import { MobileNavSheet } from "./mobile-nav-sheet";
import { ShopByCryptoMenu } from "./shop-by-crypto-menu";
import { ShopMegaMenu } from "./shop-mega-menu";

/** Throttle function for scroll handlers */
function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): T {
  let lastCall = 0;
  let timeoutId: null | ReturnType<typeof setTimeout> = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  }) as T;
}

const ADMIN_EMAILS = new Set(
  (typeof process.env.NEXT_PUBLIC_ADMIN_EMAILS === "string"
    ? process.env.NEXT_PUBLIC_ADMIN_EMAILS
    : ""
  )
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

interface HeaderProps {
  children?: React.ReactNode;
  isAdmin?: boolean;
  showAuth?: boolean;
}

export function Header({ isAdmin: isAdminProp, showAuth = true }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPending, user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // avoid hydration mismatch: server and first client render don't have session
  // in sync, so defer auth-dependent UI until after mount
  const useAuthState = mounted;
  const isAdmin =
    isAdminProp ??
    Boolean(user?.email && ADMIN_EMAILS.has(user.email.trim().toLowerCase()));

  const [shopCategories, setShopCategories] = useState<
    {
      id: string;
      name: string;
      productCount?: number;
      slug?: string;
      subcategories?: {
        id: string;
        name: string;
        productCount?: number;
        slug?: string;
      }[];
    }[]
  >([]);

  // Mega menu: exclude crypto categories (they appear in Shop by Crypto when user has Web3)
  // and the show-in-all-products category (internal use only, not a real nav category)
  const filteredShopCategories = useMemo(() => {
    return shopCategories
      .filter((cat) => !CRYPTO_CATEGORY_NAMES_SET.has(cat.name))
      .filter((cat) => cat.slug !== SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG)
      .filter((cat) => {
        const topCount = cat.productCount ?? 0;
        const subCount = (cat.subcategories ?? []).reduce(
          (sum, s) => sum + (s.productCount ?? 0),
          0,
        );
        return topCount > 0 || subCount > 0;
      })
      .map((cat) => ({
        ...cat,
        subcategories: (cat.subcategories ?? []).filter(
          (s) =>
            (s.productCount ?? 0) > 0 &&
            s.slug !== SHOW_IN_ALL_PRODUCTS_CATEGORY_SLUG,
        ),
      }));
  }, [shopCategories]);

  // Shop by Crypto menu: only show when user has authenticated via web3 (Solana or Ethereum account)
  const [hasWeb3Auth, setHasWeb3Auth] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id) {
      setHasWeb3Auth(null);
      return;
    }
    let cancelled = false;
    listUserAccounts()
      .then((res) => {
        if (cancelled || res.error) {
          if (!cancelled) setHasWeb3Auth(false);
          return;
        }
        const list = res.data ?? [];
        const web3 = list.some(
          (a: { providerId?: string }) =>
            a.providerId === "solana" || a.providerId === "ethereum",
        );
        if (!cancelled) setHasWeb3Auth(web3);
      })
      .catch(() => {
        if (!cancelled) setHasWeb3Auth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Crypto categories for "Shop by Crypto" dropdown: Currency, Network, Application (exactly that order), only with products
  const cryptoShopCategories = useMemo(() => {
    const onlyCrypto = shopCategories.filter((cat) =>
      CRYPTO_CATEGORY_NAMES_SET.has(cat.name),
    );
    const withProducts = onlyCrypto.filter((cat) => {
      const topCount = cat.productCount ?? 0;
      const subCount = (cat.subcategories ?? []).reduce(
        (sum, s) => sum + (s.productCount ?? 0),
        0,
      );
      return topCount > 0 || subCount > 0;
    });
    const currency = withProducts.find(
      (c) => c.name === "Currency (Potential)",
    );
    const network = withProducts.find(
      (c) => c.name === "Network (Artificial Organism)",
    );
    const application =
      withProducts.find((c) => c.name === "Application Token (dApps, DAOs)") ??
      withProducts.find((c) => c.name === "Application Tokens");
    const ordered = [currency, network, application].filter(
      (c): c is NonNullable<typeof c> => c != null,
    );
    return ordered.map((cat) => ({
      ...cat,
      subcategories: (cat.subcategories ?? []).filter(
        (s) => (s.productCount ?? 0) > 0,
      ),
    }));
  }, [shopCategories]);

  // Website notification prefs: show header widget only if transactional or marketing website is enabled
  const [websiteNotificationsOn, setWebsiteNotificationsOn] = useState<
    boolean | null
  >(null);

  const fetchNotificationPrefs = useCallback((): (() => void) | undefined => {
    if (!user?.id) {
      setWebsiteNotificationsOn(null);
      return undefined;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch("/api/user/notifications", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: null | {
            marketing?: { website?: boolean };
            transactional?: { website?: boolean };
          },
        ) => {
          if (!data) return;
          const transactional = data.transactional?.website ?? true;
          const marketing = data.marketing?.website ?? false;
          setWebsiteNotificationsOn(Boolean(transactional || marketing));
        },
      )
      .catch(() => setWebsiteNotificationsOn(null))
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [user?.id]);

  useEffect(() => {
    const cleanup = fetchNotificationPrefs();
    return () => cleanup?.();
  }, [fetchNotificationPrefs]);

  // Refetch when user updates notification prefs (e.g. from Dashboard → Settings)
  useEffect(() => {
    const handler = () => {
      fetchNotificationPrefs();
    };
    window.addEventListener(NOTIFICATION_PREFS_UPDATED, handler);
    return () =>
      window.removeEventListener(NOTIFICATION_PREFS_UPDATED, handler);
  }, [fetchNotificationPrefs]);

  // Fetch categories with timeout to prevent blocking navigation
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch("/api/categories", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: null | { categories?: typeof shopCategories }) => {
        if (data?.categories) setShopCategories(data.categories);
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const isDashboard = useAuthState && user && pathname.startsWith("/dashboard");
  const isCheckout =
    pathname?.startsWith("/checkout") &&
    !pathname?.startsWith("/checkout/success");

  // On checkout: hide header when scrolling down, show when scrolling up or near top.
  // Use a large delta (hysteresis) and throttle to avoid flicker and reduce CPU usage.
  const lastScrollYRef = useRef(0);
  const scrollAccumRef = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);

  const processScroll = useCallback(() => {
    const SHOW_NEAR_TOP = 80;
    const DELTA_HIDE = 80; // px scrolled down before hiding
    const DELTA_SHOW = 60; // px scrolled up before showing

    const y = window.scrollY;
    const delta = y - lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (y <= SHOW_NEAR_TOP) {
      scrollAccumRef.current = 0;
      setHeaderHidden(false);
      return;
    }

    if (delta > 0) {
      // Scrolling down: accumulate; when hidden, reset up-accumulator
      scrollAccumRef.current = Math.max(0, scrollAccumRef.current) + delta;
      if (scrollAccumRef.current >= DELTA_HIDE) {
        scrollAccumRef.current = 0;
        setHeaderHidden(true);
      }
    } else {
      // Scrolling up: accumulate negative; when visible, reset down-accumulator
      scrollAccumRef.current = Math.min(0, scrollAccumRef.current) + delta;
      if (scrollAccumRef.current <= -DELTA_SHOW) {
        scrollAccumRef.current = 0;
        setHeaderHidden(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isCheckout || typeof window === "undefined") return;

    lastScrollYRef.current = window.scrollY;
    scrollAccumRef.current = 0;

    // Throttle scroll handler to 16ms (~60fps) for better performance
    const throttledScroll = throttle(processScroll, 16);

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", throttledScroll);
    };
  }, [isCheckout, processScroll]);

  const isShopActive =
    pathname === "/products" ||
    (pathname !== "/" &&
      pathname?.startsWith("/") &&
      pathname.length > 1 &&
      !pathname.startsWith("/dashboard") &&
      !pathname.startsWith("/checkout") &&
      !pathname.startsWith("/about") &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/signup") &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/contact") &&
      !pathname.startsWith("/policies") &&
      !pathname.startsWith("/telegram") &&
      !pathname.startsWith("/membership"));
  const authPending = !useAuthState || isPending;

  const handleMobileSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = mobileSearchQuery.trim();
    if (q) {
      router.push(`/products?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  const headerEl = (
    <header
      className={cn(
        `
          w-full border-b border-border bg-background/95 text-foreground
          backdrop-blur-md
          supports-[backdrop-filter]:bg-background/80
        `,
        !isCheckout && "sticky top-0 z-40",
      )}
    >
      <div
        className={`
          container mx-auto max-w-7xl px-4
          sm:px-6
          lg:px-8
        `}
      >
        <div className="flex h-16 items-center justify-between">
          {/* Left: desktop = logo + nav; mobile = hamburger + logo. Same container padding as dashboard so content aligns. */}
          <div
            className={`
            flex items-center gap-4
            md:gap-6
          `}
          >
            {!isCheckout && (
              <Button
                aria-label="Open menu"
                className={`
                  text-[#1A1611]
                  md:hidden
                  dark:text-[#F5F1EB]
                `}
                onClick={() => setMobileMenuOpen(true)}
                size="icon"
                variant="ghost"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Link className="flex items-center gap-2" href="/">
              {SEO_CONFIG.brandLogoUrl ? (
                <Image
                  alt={SEO_CONFIG.name}
                  className="h-8 w-auto object-contain"
                  height={32}
                  priority
                  src={SEO_CONFIG.brandLogoUrl}
                  width={140}
                />
              ) : (
                <span
                  className={cn(
                    `
                      font-heading text-lg font-bold tracking-[0.2em]
                      text-[#1A1611] uppercase
                      dark:text-[#F5F1EB]
                    `,
                    !isDashboard &&
                      `
                        transition-colors duration-300
                        hover:text-primary
                      `,
                  )}
                >
                  {SEO_CONFIG.name}
                </span>
              )}
            </Link>
            {!isCheckout && (
              <nav
                className={`
                hidden
                md:flex
              `}
              >
                <ul className="flex items-center gap-6">
                  {authPending ? (
                    <>
                      <li>
                        <Skeleton className="h-6 w-14" />
                      </li>
                      <li>
                        <Skeleton className="h-6 w-12" />
                      </li>
                    </>
                  ) : (
                    <>
                      <li>
                        <ShopMegaMenu
                          categories={filteredShopCategories}
                          isActive={isShopActive}
                        />
                      </li>
                      {user &&
                        hasWeb3Auth === true &&
                        cryptoShopCategories.length > 0 && (
                          <li>
                            <ShopByCryptoMenu
                              categories={cryptoShopCategories}
                            />
                          </li>
                        )}
                      {/* Membership link hidden until launch */}
                      <li>
                        <Link
                          className={cn(
                            `
                              accent-underline text-base font-medium
                              tracking-wider transition-colors
                              hover:text-primary
                            `,
                            "normal-case", // show as "eSIM" not "ESIM"
                            pathname?.startsWith("/esim")
                              ? "font-semibold text-primary"
                              : "text-muted-foreground",
                          )}
                          href="/esim"
                        >
                          eSIM
                        </Link>
                      </li>
                      <li>
                        <Link
                          className={cn(
                            `
                              accent-underline text-base font-medium
                              tracking-wider uppercase transition-colors
                              hover:text-primary
                            `,
                            pathname === "/about"
                              ? "font-semibold text-primary"
                              : "text-muted-foreground",
                          )}
                          href="/about"
                        >
                          About
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              </nav>
            )}
          </div>

          {/* Right: search, user, cart; on mobile same order, no NotificationsWidget */}
          <div
            className={`
            flex items-center gap-2
            md:gap-4
          `}
          >
            {authPending ? (
              <>
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </>
            ) : (
              <>
                {/* Desktop: search icon; mobile: search bar below; hidden on checkout */}
                {!isCheckout && (
                  <div
                    className={`
                    hidden
                    md:block
                  `}
                  >
                    <HeaderSearch />
                  </div>
                )}
                {!isCheckout && user && websiteNotificationsOn === true && (
                  <div
                    className={`
                    hidden
                    md:flex
                  `}
                  >
                    <NotificationsWidget />
                  </div>
                )}
                {showAuth && !isCheckout && (user || !isCheckout) && (
                  <div
                    className={`
                    hidden
                    md:block
                  `}
                  >
                    {user ? (
                      <HeaderUserDropdown
                        isAdmin={isAdmin}
                        userEmail={user.email}
                        userImage={user.image}
                        userName={user.name}
                      />
                    ) : (
                      <HeaderGuestDropdown />
                    )}
                  </div>
                )}
                {!isCheckout && <Cart />}
              </>
            )}
          </div>
        </div>

        {/* Mobile: always-visible search bar below main header */}
        {!isCheckout && (
          <form
            className={`
              flex items-center gap-2 border-t
              md:hidden
            `}
            onSubmit={handleMobileSearchSubmit}
          >
            <Search
              aria-hidden
              className={`
                ml-2 h-4 w-4 shrink-0 text-[#1A1611]
                dark:text-[#F5F1EB]
              `}
            />
            <Input
              aria-label="Search products"
              className={`
                border-0 bg-transparent py-2 shadow-none
                focus-visible:ring-0
              `}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              placeholder="Search products..."
              type="search"
              value={mobileSearchQuery}
            />
          </form>
        )}
      </div>

      {/* Mobile nav drawer — no crypto ticker */}
      {!isCheckout && (
        <MobileNavSheet
          authPending={authPending}
          categories={filteredShopCategories}
          isAdmin={isAdmin}
          isShopActive={isShopActive}
          onOpenChange={setMobileMenuOpen}
          open={mobileMenuOpen}
          pathname={pathname}
          showAuth={showAuth}
          user={user}
        />
      )}
    </header>
  );

  if (isCheckout) {
    return (
      <div
        className={cn(
          `
            sticky top-0 z-40 overflow-hidden transition-[max-height]
            duration-200 ease-out
          `,
          headerHidden ? "max-h-0" : "max-h-24",
        )}
      >
        {headerEl}
      </div>
    );
  }
  return headerEl;
}
