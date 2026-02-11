import Script from "next/script";

import { TelegramChrome } from "./telegram-chrome";

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
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
        integrity="sha384-wu6NaNFje/cy2WpzoCYjC6iPCpaj31EaX/jvOdLlueI1ZvziK83GJATi3JJ3gTL+"
        crossOrigin="anonymous"
      />
      <TelegramChrome />
      <div className="min-h-screen bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
        {children}
      </div>
    </>
  );
}
