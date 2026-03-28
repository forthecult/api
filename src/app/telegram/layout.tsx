import type { Metadata } from "next";
import Script from "next/script";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

import { TelegramChrome } from "./telegram-chrome";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: `${siteUrl}/telegram`,
  },
  description: `Shop from ${SEO_CONFIG.name} inside Telegram.`,
  title: `Telegram shop | ${SEO_CONFIG.name}`,
};

/**
 * Layout for the Telegram Mini App.
 * Loads the Telegram Web App SDK so window.Telegram.WebApp is available.
 * Only used when the app is opened from Telegram (e.g. https://yourstore.com/telegram).
 */
export default function TelegramLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Script
        crossOrigin="anonymous"
        integrity="sha384-wu6NaNFje/cy2WpzoCYjC6iPCpaj31EaX/jvOdLlueI1ZvziK83GJATi3JJ3gTL+"
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <TelegramChrome />
      <div
        className={`
        min-h-screen bg-[var(--tg-theme-bg-color,#fff)]
        text-[var(--tg-theme-text-color,#000)]
      `}
      >
        {children}
      </div>
    </>
  );
}
