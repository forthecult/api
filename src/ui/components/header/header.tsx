"use client";

import { Menu, Search, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SEO_CONFIG } from "~/app";
import { NOTIFICATION_PREFS_UPDATED } from "~/lib/events";
import { listUserAccounts, useCurrentUser } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Cart } from "~/ui/components/cart";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Skeleton } from "~/ui/primitives/skeleton";

import { NotificationsWidget } from "../notifications/notifications-widget";
import { HeaderSearch } from "./header-search";
import { HeaderGuestDropdown } from "./header-guest-dropdown";
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
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

export function Header({ showAuth = true, isAdmin: isAdminProp }: HeaderProps) {
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
    Array<{
      id: string;
      name: string;
      slug?: string;
      productCount?: number;
      subcategories?: Array<{
        id: string;
        name: string;
        slug?: string;
        productCount?: number;
      }>;
    }>
  >([]);

  // Mega menu: exclude specific categories and only show categories that have products
  const MEGA_MENU_EXCLUDED_NAMES = new Set([
    "Currency (Potential)",
    "Application Tokens",
    "Application Token (dApps, DAOs)",
    "Network (Artificial Organism)",
  ]);
  const filteredShopCategories = useMemo(() => {
    return shopCategories
      .filter((cat) => !MEGA_MENU_EXCLUDED_NAMES.has(cat.name))
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
          (s) => (s.productCount ?? 0) > 0,
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
      MEGA_MENU_EXCLUDED_NAMES.has(cat.name),
    );
    const withProducts = onlyCrypto.filter((cat) => {
      const topCount = cat.productCount ?? 0;
      const subCount = (cat.subcategories ?? []).reduce(
        (sum, s) => sum + (s.productCount ?? 0),
        0,
      );
      return topCount > 0 || subCount > 0;
    });
    const currency = withProducts.find((c) => c.name === "Currency (Potential)");
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
  const [websiteNotificationsOn, setWebsiteNotificationsOn] = useState<boolean | null>(null);

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
        (data: {
          transactional?: { website?: boolean };
          marketing?: { website?: boolean };
        } | null) => {
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
    return () => window.removeEventListener(NOTIFICATION_PREFS_UPDATED, handler);
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
      .then((data: { categories?: typeof shopCategories } | null) => {
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
  const isCheckout = pathname?.startsWith("/checkout") && !pathname?.startsWith("/checkout/success");

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
      router.push(`/products?search=${encodeURIComponent(q)}`);
    } else {
      router.push("/products");
    }
  };

  const headerEl = (
    <header
      className={cn(
        "w-full border-b border-[#2A2A2A] bg-[#111111]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#111111]/80",
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
          <div className="flex items-center gap-4 md:gap-6">
            {!isCheckout && (
              <Button
                aria-label="Open menu"
                className="md:hidden"
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
                  src={SEO_CONFIG.brandLogoUrl}
                  alt={SEO_CONFIG.name}
                  width={140}
                  height={32}
                  className="h-8 w-auto object-contain"
                  priority
                />
              ) : (
                <span
                  className={cn(
                    "font-heading text-lg font-bold tracking-[0.2em] uppercase text-[#F5F1EB]",
                    !isDashboard && "hover:text-[#C4873A] transition-colors duration-300",
                  )}
                >
                  {SEO_CONFIG.name}
                </span>
              )}
            </Link>
            {!isCheckout && (
              <nav className="hidden md:flex">
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
                            "accent-underline text-sm font-medium tracking-wider transition-colors hover:text-[#C4873A]",
                            "normal-case", // show as "eSIM" not "ESIM"
                            pathname?.startsWith("/esim")
                              ? "font-semibold text-[#C4873A]"
                              : "text-[#8A857E]",
                          )}
                          href="/esim"
                        >
                          eSIM
                        </Link>
                      </li>
                      <li>
                        <Link
                          className={cn(
                            "accent-underline text-sm font-medium uppercase tracking-wider transition-colors hover:text-[#C4873A]",
                            pathname === "/about"
                              ? "font-semibold text-[#C4873A]"
                              : "text-[#8A857E]",
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
          <div className="flex items-center gap-2 md:gap-4">
            {authPending ? (
              <>
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-full" />
              </>
            ) : (
              <>
                {/* Desktop: search icon; mobile: search bar below; hidden on checkout */}
                {!isCheckout && (
                  <div className="hidden md:block">
                    <HeaderSearch />
                  </div>
                )}
                {!isCheckout && user && websiteNotificationsOn === true && (
                  <div className="hidden md:flex">
                    <NotificationsWidget />
                  </div>
                )}
                {showAuth && !isCheckout && (user || !isCheckout) && (
                  <div className="hidden md:block">
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
            onSubmit={handleMobileSearchSubmit}
            className="flex items-center gap-2 border-t md:hidden"
          >
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              placeholder="Search products..."
              value={mobileSearchQuery}
              onChange={(e) => setMobileSearchQuery(e.target.value)}
              className="border-0 bg-transparent py-2 shadow-none focus-visible:ring-0"
              aria-label="Search products"
            />
          </form>
        )}
      </div>

      {/* Mobile nav drawer — no crypto ticker */}
      {!isCheckout && (
        <MobileNavSheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          categories={filteredShopCategories}
          pathname={pathname}
          user={user}
          authPending={authPending}
          isAdmin={isAdmin}
          showAuth={showAuth}
          isShopActive={isShopActive}
        />
      )}
    </header>
  );

  if (isCheckout) {
    return (
      <div
        className={cn(
          "sticky top-0 z-40 overflow-hidden transition-[max-height] duration-200 ease-out",
          headerHidden ? "max-h-0" : "max-h-24",
        )}
      >
        {headerEl}
      </div>
    );
  }
  return headerEl;
}
