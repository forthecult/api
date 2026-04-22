import type { Metadata } from "next";

import { Geist, Geist_Mono, Manrope } from "next/font/google";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";
import { LazySolanaWalletProvider } from "~/app/checkout/crypto/lazy-solana-wallet-provider";
import { getPublicSiteUrl, isAgentSubdomain } from "~/lib/app-url";
import { AnalyticsProvider } from "~/lib/analytics/analytics-provider";
import { CartProvider } from "~/lib/hooks/use-cart";
import { CountryCurrencyProvider } from "~/lib/hooks/use-country-currency";
import "~/css/globals.css";
import { CryptoCurrencyProvider } from "~/lib/hooks/use-crypto-currency";
import { LazyWagmiProvider } from "~/lib/lazy-wagmi-provider";
import { AgentSubdomainLayout } from "~/ui/components/agent-subdomain-layout";
import { AuthWalletModalProvider } from "~/ui/components/auth/auth-wallet-modal-provider";
import { BackToTopButton } from "~/ui/components/back-to-top-button";
import { ChunkLoadErrorHandler } from "~/ui/components/chunk-load-error-handler";
import { ConditionalFooter } from "~/ui/components/conditional-footer";
import { ConsoleSecurityWarning } from "~/ui/components/console-security-warning";
import { DeferredCriticalRoutePrefetcher } from "~/ui/components/deferred-critical-route-prefetcher";
import { DeferredSpeedInsights } from "~/ui/components/deferred-speed-insights";
import { ConditionalHeader } from "~/ui/components/header/conditional-header";
import { MainWithDogePadding } from "~/ui/components/main-with-doge-padding";
import { OrganizationWebSiteJsonLd } from "~/ui/components/structured-data";
import { SupportChatWidgetWrapper } from "~/ui/components/support-chat/support-chat-widget-wrapper";
import { ThemePersistSync } from "~/ui/components/theme-persist-sync";
import { ThemeProvider } from "~/ui/components/theme-provider";
import { WalletErrorBoundary } from "~/ui/components/wallet-error-boundary";
import { Toaster } from "~/ui/primitives/sonner";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

// geist mono also powers the "crypto / data" numeric style (previously a separate JetBrains Mono family).
// one mono family is enough and saves a round-trip font download on every page.
const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const manrope = Manrope({
  display: "swap",
  preload: false,
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700", "800"],
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
    // no default canonical: would inherit onto routes that omit alternates and collapse everything to /
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
            ${manrope.variable}
            min-h-screen bg-background text-foreground antialiased
            selection:bg-primary/30
          `}
        >
          <ConsoleSecurityWarning />
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          ${manrope.variable}
          min-h-screen bg-background text-foreground antialiased
          selection:bg-[#C4873A]/30
        `}
        suppressHydrationWarning
      >
        <ConsoleSecurityWarning />
        <ChunkLoadErrorHandler />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem
        >
          <AnalyticsProvider>
            {/* no initial theme is fetched server-side: next-themes restores from localStorage for
              returning users, and ThemePersistSync backfills cross-device theme via idle fetch. */}
            <ThemePersistSync />
            <DeferredCriticalRoutePrefetcher />
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
          </AnalyticsProvider>
        </ThemeProvider>
        {/* SpeedInsights deferred until idle so it doesn't compete with LCP; only on Vercel */}
        {process.env.NEXT_PUBLIC_VERCEL === "1" ? (
          <DeferredSpeedInsights />
        ) : null}
        <OrganizationWebSiteJsonLd />
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
    <div className="flex min-h-screen flex-col">
      <ConditionalHeader showAuth={true} />
      <main className="flex min-h-0 flex-1 flex-col bg-background">
        <MainWithDogePadding className="flex min-h-0 flex-1 flex-col">
          {children}
        </MainWithDogePadding>
      </main>
      <ConditionalFooter />
      <BackToTopButton />
      <SupportChatWidgetWrapper />
      <Toaster />
    </div>
  );
}

/** Single wrapper for store layout: wallet boundary + Wagmi (lazy) + Solana (token-gating) + auth modal + shell. */
function StoreLayoutWrapper({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <WalletErrorBoundary>
      <LazyWagmiProvider>
        <LazySolanaWalletProvider>
          <AuthWalletModalProvider>
            <LayoutShell>{children}</LayoutShell>
          </AuthWalletModalProvider>
        </LazySolanaWalletProvider>
      </LazyWagmiProvider>
    </WalletErrorBoundary>
  );
}
