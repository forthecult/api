"use client";

import {
  Cloud,
  Database,
  LayoutDashboard,
  MessageSquareText,
  Plug,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/cn";

const NAV = [
  { href: "/dashboard/ai", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/ai/storage", icon: Database, label: "Storage & data" },
  {
    href: "/dashboard/ai/prompts",
    icon: MessageSquareText,
    label: "Prompts & memory",
  },
  { href: "/dashboard/ai/cloud", icon: Cloud, label: "Cloud data" },
  { href: "/dashboard/ai/channels", icon: Plug, label: "Channels" },
] as const;

export function AiSettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  return (
    <div className={`
      flex flex-col gap-6
      lg:flex-row lg:gap-8
    `}>
      <nav
        aria-label="AI settings"
        className={`
          flex shrink-0 flex-row gap-1 overflow-x-auto rounded-xl border
          border-border bg-card p-1
          lg:w-52 lg:flex-col
        `}
      >
        {NAV.map(({ href, icon: Icon, label }) => {
          const active =
            href === "/dashboard/ai"
              ? pathname === href
              : pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              className={cn(
                `
                  flex items-center gap-2 rounded-lg px-3 py-2 text-sm
                  font-medium whitespace-nowrap transition-colors
                `,
                active
                  ? "bg-muted text-foreground"
                  : `
                    text-muted-foreground
                    hover:bg-muted/60 hover:text-foreground
                  `,
              )}
              href={href}
              key={href}
            >
              <Icon aria-hidden className="h-4 w-4 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
