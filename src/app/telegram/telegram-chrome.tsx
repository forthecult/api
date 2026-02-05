"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Shows Telegram BackButton when on a subpage (/telegram/cart, /telegram/checkout, /telegram/orders/…).
 * Mounted from telegram layout so it runs on all telegram routes.
 */
export function TelegramChrome() {
  const pathname = usePathname();
  const isSubpage =
    pathname === "/telegram/cart" ||
    pathname?.startsWith("/telegram/checkout") ||
    pathname?.startsWith("/telegram/orders/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    if (isSubpage) {
      tg.BackButton.show();
      const handleBack = () => window.history.back();
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      };
    }
    tg.BackButton.hide();
  }, [isSubpage]);

  return null;
}
