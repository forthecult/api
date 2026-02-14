import type { Metadata } from "next";

import "~/app/globals.css";

export const metadata: Metadata = {
  title: "Admin | For the Cult",
  description: "Admin dashboard",
};

/** Server has env at runtime (e.g. Railway); Next bakes NEXT_PUBLIC_* at build time. Inject so client can use it. */
function MainAppUrlScript() {
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const value =
    raw && !raw.startsWith("http://") && !raw.startsWith("https://")
      ? `https://${raw}`
      : raw;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__MAIN_APP_URL=${JSON.stringify(value)};`,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <MainAppUrlScript />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
