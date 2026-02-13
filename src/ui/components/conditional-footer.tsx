"use client";

import { usePathname } from "next/navigation";

import { Footer } from "~/ui/components/footer";

/** Renders Footer everywhere except checkout, login, signup, and Telegram Mini App. */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/checkout")) return null;
  if (pathname?.startsWith("/telegram")) return null;
  if (pathname === "/login" || pathname === "/signup") return null;
  return <Footer />;
}
