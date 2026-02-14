import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { Suspense } from "react";

import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono, JetBrains_Mono, Manrope } from "next/font/google";
import { extractRouterConfig } from "uploadthing/server";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl, isAgentSubdomain } from "~/lib/app-url";
import { AgentSubdomainLayout } from "~/ui/components/agent-subdomain-layout";
import { ourFileRouter } from "~/app/api/uploadthing/core";
import { CartProvider } from "~/lib/hooks/use-cart";
import { CountryCurrencyProvider } from "~/lib/hooks/use-country-currency";
import { CryptoCurrencyProvider } from "~/lib/hooks/use-crypto-currency";
import "~/css/globals.css";
import { AuthWalletModalProvider } from "~/ui/components/auth/auth-wallet-modal-provider";
import { WalletErrorBoundary } from "~/ui/components/wallet-error-boundary";
import { ConditionalFooter } from "~/ui/components/conditional-footer";
import { ConditionalHeader } from "~/ui/components/header/conditional-header";
import { SupportChatWidgetWrapper } from "~/ui/components/support-chat/support-chat-widget-wrapper";
import { CriticalRoutePrefetcher } from "~/ui/components/critical-route-prefetcher";
import {
  OrganizationStructuredData,
  WebSiteStructuredData,
} from "~/ui/components/structured-data";
import { WagmiProvider } from "~/lib/wagmi-provider";
import { ThemeProvider } from "~/ui/components/theme-provider";
import { Toaster } from "~/ui/primitives/sonner";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-crypto",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800"],
});

// getPublicSiteUrl() ensures full https:// URL and handles host-only env values (e.g. Railway)
const siteUrl = getPublicSiteUrl();

/** Staging: Vercel preview deploys or explicit STAGING=1. Block indexing only on staging. */
const isStaging =
  process.env.VERCEL_ENV === "preview" || process.env.STAGING === "1";

/** Default OG image for social sharing — used by every page unless overridden. */
const DEFAULT_OG_IMAGE = "/lookbook/culture-brand-lifestyle-premium-apparel.jpg";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl),
    description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
    keywords: SEO_CONFIG.keywords?.split(",").map((k) => k.trim()),
    openGraph: {
      description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
      title: SEO_CONFIG.fullName,
      type: "website",
      siteName: SEO_CONFIG.fullName,
      locale: "en_US",
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${SEO_CONFIG.fullName} — curated tech, apparel & wellness gear`,
        },
      ],
    },
    title: {
      default: SEO_CONFIG.fullName,
      template: `%s | ${SEO_CONFIG.name}`,
    },
    twitter: {
      card: "summary_large_image",
      description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
      title: SEO_CONFIG.fullName,
      images: [DEFAULT_OG_IMAGE],
    },
    alternates: {
      canonical: "/",
    },
    robots: isStaging
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
    icons: {
      icon: [
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
    },
  };
}

function LayoutShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ConditionalHeader showAuth={true} />
      <main className="flex min-h-screen flex-col bg-[#111111]">{children}</main>
      <ConditionalFooter />
      <SupportChatWidgetWrapper />
      <Toaster />
    </>
  );
}

async function CookieCountryProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let countryCookie: string | null = null;
  try {
    const cookieStore = await cookies();
    countryCookie = cookieStore.get("country-currency")?.value ?? null;
  } catch {
    // ignore; use null so provider falls back to default
  }
  return (
    <CountryCurrencyProvider initialCountry={countryCookie}>
      {children}
    </CountryCurrencyProvider>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const useAgentLayout = isAgentSubdomain(host);

  if (useAgentLayout) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body
          className={`
            ${geistSans.variable}
            ${geistMono.variable}
            ${jetbrainsMono.variable}
            ${manrope.variable}
            min-h-screen bg-background text-foreground antialiased
            selection:bg-primary/30
          `}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            <AgentSubdomainLayout>{children}</AgentSubdomainLayout>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          ${jetbrainsMono.variable}
          ${manrope.variable}
          min-h-screen bg-background text-foreground antialiased
          selection:bg-[#C4873A]/30
        `}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem
        >
          <CriticalRoutePrefetcher />
          <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
          <CartProvider>
            <CryptoCurrencyProvider>
              <Suspense
                fallback={
                  <CountryCurrencyProvider initialCountry={null}>
                    <WalletErrorBoundary>
                      <WagmiProvider>
                        <AuthWalletModalProvider>
                          <LayoutShell>{children}</LayoutShell>
                        </AuthWalletModalProvider>
                      </WagmiProvider>
                    </WalletErrorBoundary>
                  </CountryCurrencyProvider>
                }
              >
                <CookieCountryProvider>
                  <WalletErrorBoundary>
                    <WagmiProvider>
                      <AuthWalletModalProvider>
                        <LayoutShell>{children}</LayoutShell>
                      </AuthWalletModalProvider>
                    </WagmiProvider>
                  </WalletErrorBoundary>
                </CookieCountryProvider>
              </Suspense>
            </CryptoCurrencyProvider>
          </CartProvider>
        </ThemeProvider>
        {/* SpeedInsights only on Vercel; script 404s on other hosts (e.g. Railway) and can cause console noise */}
        {process.env.NEXT_PUBLIC_VERCEL === "1" ? <SpeedInsights /> : null}
        {/* Structured data for search engines */}
        <OrganizationStructuredData />
        <WebSiteStructuredData />
      </body>
    </html>
  );
}
