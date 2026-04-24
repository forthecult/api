import type { Metadata } from "next";

import "~/app/globals.css";

export const metadata: Metadata = {
  description: "Admin dashboard",
  title: "Admin | For the Cult",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <StorefrontOriginMeta />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

/** runtime storefront URL for links (client reads meta; avoids inline script + innerHTML). */
function StorefrontOriginMeta() {
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const value =
    raw && !raw.startsWith("http://") && !raw.startsWith("https://")
      ? `https://${raw}`
      : raw;
  if (!value) return null;
  return <meta content={value} name="culture-storefront-origin" />;
}
