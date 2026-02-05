"use client";

import { usePathname } from "next/navigation";

import { Header } from "./header";
import { TopBanner } from "./top-banner";

function isCryptoPayPage(pathname: string | null): boolean {
  if (pathname == null) return false;
  if (!pathname.startsWith("/checkout/")) return false;
  if (pathname === "/checkout/cancelled" || pathname === "/checkout/success")
    return false;
  return pathname.length > "/checkout/".length;
}

/** Renders TopBanner + Header except on checkout (no banner) and on crypto payment page (/checkout/[invoiceId], no header/banner). */
export function ConditionalHeader(props: React.ComponentProps<typeof Header>) {
  const pathname = usePathname();
  if (isCryptoPayPage(pathname)) return null;
  const isCheckout = pathname?.startsWith("/checkout") ?? false;
  return (
    <>
      {!isCheckout && <TopBanner />}
      <Header {...props} />
    </>
  );
}
