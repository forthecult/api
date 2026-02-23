"use client";

import {
  ChevronDown,
  ChevronLeft,
  Circle,
  CreditCard,
  Crown,
  FileText,
  FolderTree,
  Globe,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Tags,
  TicketPercent,
  Truck,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";

interface NavItem {
  href: string;
  label: string;
}

interface NavSection {
  children?: NavItem[];
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const ADMIN_SECTIONS: NavSection[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    children: [
      { href: "/products", label: "Product List" },
      { href: "/products/create", label: "Create Product" },
      { href: "/products/size-charts", label: "Size Charts" },
      { href: "/products/reviews", label: "Product Reviews" },
    ],
    icon: Package,
    label: "Products",
  },
  {
    children: [
      { href: "/categories", label: "Category List" },
      { href: "/categories/create", label: "Create Category" },
    ],
    icon: FolderTree,
    label: "Categories",
  },
  {
    children: [
      { href: "/brands", label: "Brand List" },
      { href: "/brands/create", label: "Create Brand" },
    ],
    icon: Tags,
    label: "Brands",
  },
  {
    children: [
      { href: "/orders", label: "Order List" },
      { href: "/orders/create", label: "Create Order" },
    ],
    icon: ShoppingCart,
    label: "Orders",
  },
  {
    children: [
      { href: "/payment-methods", label: "Payment methods" },
      { href: "/payments/solana-pay", label: "Solana Pay" },
    ],
    icon: CreditCard,
    label: "Payments",
  },
  {
    href: "/customers",
    icon: Users,
    label: "Customers",
  },
  {
    href: "/membership",
    icon: Crown,
    label: "Membership",
  },
  {
    href: "/refunds",
    icon: RefreshCw,
    label: "Refunds",
  },
  {
    children: [
      { href: "/shipping-options", label: "Shipping Options" },
      { href: "/shipping-options/create", label: "Create Option" },
    ],
    icon: Truck,
    label: "Shipping",
  },
  {
    children: [
      { href: "/coupons", label: "Coupon List" },
      { href: "/coupons/create", label: "Create Coupon" },
      { href: "/tier-discounts", label: "Tier Discounts" },
    ],
    icon: TicketPercent,
    label: "Discounts",
  },
  {
    href: "/affiliates",
    icon: Users,
    label: "Affiliates",
  },
  {
    children: [
      { href: "/support-tickets", label: "Support Tickets" },
      { href: "/support-chat", label: "Support Chat" },
    ],
    icon: Headphones,
    label: "Support",
  },
  {
    href: "/notifications",
    icon: Mail,
    label: "Notifications",
  },
  {
    children: [
      { href: "/blog", label: "Blog posts" },
      { href: "/blog/create", label: "Create post" },
    ],
    icon: FileText,
    label: "Blog",
  },
  {
    href: "/site-settings",
    icon: Settings,
    label: "Site Settings",
  },
  {
    href: "/token-gates/pages",
    icon: KeyRound,
    label: "Token Gates",
  },
  {
    href: "/profile",
    icon: User,
    label: "Profile",
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const s of ADMIN_SECTIONS) {
      if (s.children && sectionContainsPath(s, pathname)) open.add(s.label);
    }
    return open;
  });

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const s of ADMIN_SECTIONS) {
        if (s.children && sectionContainsPath(s, pathname)) next.add(s.label);
      }
      return next;
    });
  }, [pathname]);

  const toggleExpanded = useCallback((label: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        `
          flex flex-col border-r border-white/10 bg-zinc-900 text-white
          transition-[width] duration-200
        `,
        collapsed ? "w-[60px]" : "w-56",
      )}
    >
      {/* Logo + collapse */}
      <div
        className={`
        flex h-14 shrink-0 items-center justify-between border-b border-white/10
        px-3
      `}
      >
        {!collapsed && (
          <Link className="font-semibold tracking-tight" href="/dashboard">
            Admin
          </Link>
        )}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center rounded-md
            text-white/70 transition-colors
            hover:bg-white/10 hover:text-white
          `}
          onClick={() => setCollapsed((c) => !c)}
          type="button"
        >
          <ChevronLeft
            aria-hidden
            className={cn("h-4 w-4", collapsed && "rotate-180")}
          />
        </button>
      </div>

      {/* ADMIN label */}
      {!collapsed && (
        <div
          className={`
          px-3 py-2 text-xs font-medium tracking-wider text-white/50 uppercase
        `}
        >
          Admin
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <ul className="space-y-0.5">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            const hasChildren = section.children && section.children.length > 0;
            const isExpanded = expanded.has(section.label);
            const isActive = section.href
              ? pathMatches(section.href, pathname)
              : hasChildren &&
                section.children!.some((c) => pathMatches(c.href, pathname));
            const shouldExpand =
              isExpanded ||
              (hasChildren && sectionContainsPath(section, pathname));

            if (section.href && !hasChildren) {
              return (
                <li key={section.label}>
                  <Link
                    className={cn(
                      `
                        flex items-center gap-2 rounded-md px-2 py-2 text-sm
                        transition-colors
                      `,
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-blue-600 text-white"
                        : `
                          text-white/90
                          hover:bg-white/10 hover:text-white
                        `,
                    )}
                    data-nav={section.label.toLowerCase().replace(/\s+/g, "-")}
                    href={section.href}
                    title={collapsed ? section.label : undefined}
                  >
                    <Icon aria-hidden className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{section.label}</span>}
                  </Link>
                </li>
              );
            }

            return (
              <li key={section.label}>
                <button
                  className={cn(
                    `
                      flex w-full items-center gap-2 rounded-md px-2 py-2
                      text-left text-sm transition-colors
                    `,
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-blue-600 text-white"
                      : `
                        text-white/90
                        hover:bg-white/10 hover:text-white
                      `,
                  )}
                  onClick={() => toggleExpanded(section.label)}
                  title={collapsed ? section.label : undefined}
                  type="button"
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{section.label}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          shouldExpand && "rotate-180",
                        )}
                      />
                    </>
                  )}
                </button>
                {!collapsed && hasChildren && shouldExpand && (
                  <ul
                    className={`
                    mt-0.5 ml-4 space-y-0.5 border-l border-white/10 pl-3
                  `}
                  >
                    {section.children!.map((item) => {
                      const itemActive = pathMatches(item.href, pathname);
                      return (
                        <li key={item.href}>
                          <Link
                            className={cn(
                              `
                                flex items-center gap-2 rounded-md py-1.5 pl-1
                                text-sm transition-colors
                              `,
                              itemActive
                                ? "font-medium text-blue-300"
                                : `
                                  text-white/80
                                  hover:text-white
                                `,
                            )}
                            href={item.href}
                          >
                            <Circle
                              aria-hidden
                              className={cn(
                                "h-1.5 w-1.5 shrink-0",
                                itemActive
                                  ? "fill-blue-400 text-blue-400"
                                  : "text-white/50",
                              )}
                            />
                            <span className={cn(itemActive && "font-medium")}>
                              {item.label}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export function BrowseWebsiteLink() {
  const mainAppUrl = getMainAppUrl();

  return (
    <a
      className={`
        inline-flex items-center gap-2 rounded-md border border-input
        bg-background px-3 py-2 text-sm font-medium transition-colors
        hover:bg-muted hover:text-foreground
      `}
      href={mainAppUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Globe aria-hidden className="h-4 w-4" />
      Browse Website
    </a>
  );
}

function pathMatches(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return false;
}

function sectionContainsPath(section: NavSection, pathname: string): boolean {
  if (section.href && pathMatches(section.href, pathname)) return true;
  if (section.children?.some((c) => pathMatches(c.href, pathname))) return true;
  return false;
}
