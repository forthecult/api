"use client";

import { getMainAppUrl } from "~/lib/env";
import {
  ChevronDown,
  ChevronLeft,
  Circle,
  CreditCard,
  LayoutDashboard,
  Package,
  FolderTree,
  Tags,
  ShoppingCart,
  Users,
  RefreshCw,
  Truck,
  TicketPercent,
  MessageSquare,
  Headphones,
  Mail,
  Settings,
  KeyRound,
  User,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";

type NavItem = {
  href: string;
  label: string;
};

type NavSection = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: NavItem[];
};

const ADMIN_SECTIONS: NavSection[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Products",
    icon: Package,
    children: [
      { href: "/products", label: "Product List" },
      { href: "/products/create", label: "Create Product" },
      { href: "/products/reviews", label: "Product Reviews" },
    ],
  },
  {
    label: "Categories",
    icon: FolderTree,
    children: [
      { href: "/categories", label: "Category List" },
      { href: "/categories/create", label: "Create Category" },
    ],
  },
  {
    label: "Brands",
    icon: Tags,
    children: [
      { href: "/brands", label: "Brand List" },
      { href: "/brands/create", label: "Create Brand" },
    ],
  },
  {
    label: "Orders",
    icon: ShoppingCart,
    children: [
      { href: "/orders", label: "Order List" },
      { href: "/orders/create", label: "Create Order" },
    ],
  },
  {
    label: "Payment methods",
    icon: CreditCard,
    href: "/payment-methods",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/customers",
  },
  {
    label: "Refunds",
    icon: RefreshCw,
    href: "/refunds",
  },
  {
    label: "Shipping",
    icon: Truck,
    children: [
      { href: "/shipping-options", label: "Shipping Options" },
      { href: "/shipping-options/create", label: "Create Option" },
    ],
  },
  {
    label: "Discounts",
    icon: TicketPercent,
    children: [
      { href: "/coupons", label: "Coupon List" },
      { href: "/coupons/create", label: "Create Coupon" },
    ],
  },
  {
    label: "Affiliates",
    icon: Users,
    href: "/affiliates",
  },
  {
    label: "Support",
    icon: Headphones,
    children: [
      { href: "/support-tickets", label: "Support Tickets" },
      { href: "/support-chat", label: "Support Chat" },
    ],
  },
  {
    label: "Notifications",
    icon: Mail,
    href: "/notifications",
  },
  {
    label: "Site Settings",
    icon: Settings,
    href: "/site-settings",
  },
  {
    label: "Token Gates",
    icon: KeyRound,
    href: "/token-gates/pages",
  },
  {
    label: "Profile",
    icon: User,
    href: "/profile",
  },
];

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
        "flex flex-col border-r border-white/10 bg-zinc-900 text-white transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-56",
      )}
    >
      {/* Logo + collapse */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3">
        {!collapsed && (
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Admin
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn("h-4 w-4", collapsed && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {/* ADMIN label */}
      {!collapsed && (
        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-white/50">
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
              isExpanded || (hasChildren && sectionContainsPath(section, pathname));

            if (section.href && !hasChildren) {
              return (
                <li key={section.label}>
                  <Link
                    href={section.href}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                      collapsed && "justify-center px-0",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-white/90 hover:bg-white/10 hover:text-white",
                    )}
                    title={collapsed ? section.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && <span>{section.label}</span>}
                  </Link>
                </li>
              );
            }

            return (
              <li key={section.label}>
                <button
                  type="button"
                  onClick={() => toggleExpanded(section.label)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-white/90 hover:bg-white/10 hover:text-white",
                  )}
                  title={collapsed ? section.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{section.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 transition-transform",
                          shouldExpand && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </>
                  )}
                </button>
                {!collapsed && hasChildren && shouldExpand && (
                  <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {section.children!.map((item) => {
                      const itemActive = pathMatches(item.href, pathname);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-2 rounded-md py-1.5 pl-1 text-sm transition-colors",
                              itemActive
                                ? "text-blue-300 font-medium"
                                : "text-white/80 hover:text-white",
                            )}
                          >
                            <Circle
                              className={cn(
                                "h-1.5 w-1.5 shrink-0",
                                itemActive ? "fill-blue-400 text-blue-400" : "text-white/50",
                              )}
                              aria-hidden
                            />
                            <span
                              className={cn(
                                itemActive && "font-medium",
                              )}
                            >
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
      href={mainAppUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
    >
      <Globe className="h-4 w-4" aria-hidden />
      Browse Website
    </a>
  );
}
