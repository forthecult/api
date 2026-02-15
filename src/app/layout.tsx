import type { Metadata } from "next";

import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist, Geist_Mono, JetBrains_Mono, Manrope } from "next/font/google";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { extractRouterConfig } from "uploadthing/server";

import { SEO_CONFIG } from "~/app";
import { ourFileRouter } from "~/app/api/uploadthing/core";
import { getPublicSiteUrl, isAgentSubdomain } from "~/lib/app-url";
import { getCurrentUserTheme } from "~/lib/get-current-user-theme";
import { CartProvider } from "~/lib/hooks/use-cart";
import { CountryCurrencyProvider } from "~/lib/hooks/use-country-currency";
import { CryptoCurrencyProvider } from "~/lib/hooks/use-crypto-currency";
import "~/css/globals.css";
import { WagmiProvider } from "~/lib/wagmi-provider";
import { AgentSubdomainLayout } from "~/ui/components/agent-subdomain-layout";
import { AuthWalletModalProvider } from "~/ui/components/auth/auth-wallet-modal-provider";
import { ConditionalFooter } from "~/ui/components/conditional-footer";
import { CriticalRoutePrefetcher } from "~/ui/components/critical-route-prefetcher";
import { ConditionalHeader } from "~/ui/components/header/conditional-header";
import {
  OrganizationStructuredData,
  WebSiteStructuredData,
} from "~/ui/components/structured-data";
import { SupportChatWidgetWrapper } from "~/ui/components/support-chat/support-chat-widget-wrapper";
import { ThemePersistSync } from "~/ui/components/theme-persist-sync";
import { ThemeProvider } from "~/ui/components/theme-provider";
import { ChunkLoadErrorHandler } from "~/ui/components/chunk-load-error-handler";
import { WalletErrorBoundary } from "~/ui/components/wallet-error-boundary";
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
const DEFAULT_OG_IMAGE =
  "/lookbook/culture-brand-lifestyle-premium-apparel.jpg";

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: {
      canonical: "/",
    },
    description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
    icons: {
      icon: [
        { sizes: "32x32", type: "image/png", url: "/favicon-32x32.png" },
        { sizes: "16x16", type: "image/png", url: "/favicon-16x16.png" },
      ],
    },
    keywords: SEO_CONFIG.keywords?.split(",").map((k) => k.trim()),
    metadataBase: new URL(siteUrl),
    openGraph: {
      description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
      images: [
        {
          alt: `${SEO_CONFIG.fullName} — curated tech, apparel & wellness gear`,
          height: 630,
          url: DEFAULT_OG_IMAGE,
          width: 1200,
        },
      ],
      locale: "en_US",
      siteName: SEO_CONFIG.fullName,
      title: SEO_CONFIG.fullName,
      type: "website",
    },
    robots: isStaging
      ? { follow: false, index: false }
      : {
          follow: true,
          googleBot: {
            follow: true,
            index: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
          index: true,
        },
    title: {
      default: SEO_CONFIG.fullName,
      template: `%s | ${SEO_CONFIG.name}`,
    },
    twitter: {
      card: "summary_large_image",
      description: SEO_CONFIG.metaDescription ?? SEO_CONFIG.description,
      images: [DEFAULT_OG_IMAGE],
      title: SEO_CONFIG.fullName,
    },
  };
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
          <ChunkLoadErrorHandler />
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

  const initialUserTheme = await getCurrentUserTheme();

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
        <ChunkLoadErrorHandler />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem
        >
          <ThemePersistSync initialUserTheme={initialUserTheme} />
          <CriticalRoutePrefetcher />
          <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
          <CartProvider>
            <CryptoCurrencyProvider>
              <Suspense
                fallback={
                  <CountryCurrencyProvider initialCountry={null}>
                    <StoreLayoutWrapper>{children}</StoreLayoutWrapper>
                  </CountryCurrencyProvider>
                }
              >
                <CookieCountryProvider>
                  <StoreLayoutWrapper>{children}</StoreLayoutWrapper>
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

async function CookieCountryProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let countryCookie: null | string = null;
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

function LayoutShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ConditionalHeader showAuth={true} />
      <main className="flex min-h-screen flex-col bg-background">
        {children}
      </main>
      <ConditionalFooter />
      <SupportChatWidgetWrapper />
      <Toaster />
    </>
  );
}

/** Single wrapper for store layout: wallet boundary + wagmi + auth modal + shell. Avoids duplicating the tree in fallback vs actual. */
function StoreLayoutWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WalletErrorBoundary>
      <WagmiProvider>
        <AuthWalletModalProvider>
          <LayoutShell>{children}</LayoutShell>
        </AuthWalletModalProvider>
      </WagmiProvider>
    </WalletErrorBoundary>
  );
}
