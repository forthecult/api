import type { Metadata } from "next";

import "~/app/globals.css";

export const metadata: Metadata = {
  title: "Admin | Culture Store",
  description: "Admin dashboard",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
