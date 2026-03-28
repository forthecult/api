"use client";

import { usePathname } from "next/navigation";

import { Header } from "./header";
import { TopBanner } from "./top-banner";

/** Renders TopBanner + Header except on checkout (no banner), on /chat (no banner), on crypto payment page (/checkout/[invoiceId], no header/banner), and inside Telegram Mini App (/telegram). */
export function ConditionalHeader(props: React.ComponentProps<typeof Header>) {
  const pathname = usePathname();
  if (isCryptoPayPage(pathname)) return null;
  if (pathname?.startsWith("/telegram")) return null;
  const isCheckout = pathname?.startsWith("/checkout") ?? false;
  const hideTopBanner = isCheckout || pathname === "/chat";
  return (
    <>
      {!hideTopBanner && <TopBanner />}
      <Header {...props} />
    </>
  );
}

function isCryptoPayPage(pathname: null | string): boolean {
  if (pathname == null) return false;
  if (!pathname.startsWith("/checkout/")) return false;
  if (pathname === "/checkout/cancelled" || pathname === "/checkout/success")
    return false;
  return pathname.length > "/checkout/".length;
}
