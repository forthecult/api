import type { NextConfig } from "next";

import createBundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";

const wagmiStub = path.resolve(
  process.cwd(),
  "src/lib/wagmi-connector-stub.js",
);
const emptyModuleStub = path.resolve(
  process.cwd(),
  "src/lib/empty-module-stub.js",
);

function resolveWalletConnect(): string {
  try {
    // Turbopack resolveAlias expects module specifiers, not absolute filesystem paths.
    require.resolve("@walletconnect/ethereum-provider", {
      paths: [process.cwd()],
    });
    return "@walletconnect/ethereum-provider";
  } catch {
    return wagmiStub;
  }
}

/** Legacy category slugs (tickers) → SEO-friendly full names. 301 so search and bookmarks land on canonical URLs. */
const CATEGORY_REDIRECTS: [string, string][] = [
  ["/btc", "/bitcoin"],
  ["/eth", "/ethereum"],
  ["/doge", "/dogecoin"],
  ["/xmr", "/monero"],
  ["/ltc", "/litecoin"],
  ["/zec", "/zcash"],
  ["/avax", "/avalanche"],
  ["/atom", "/cosmos"],
  ["/fil", "/filecoin"],
  ["/ton", "/toncoin"],
  ["/sol", "/solana"],
  ["/pump", "/pump-fun"],
  ["/stickers", "/crypto-stickers"],
];

const config = {
  // Enable gzip/brotli compression
  compress: true,

  // typedRoutes: true — deferred. Next.js 16 stabilised this at the top level,
  // but flipping it on across 78+ pages with dynamic string-built hrefs would
  // flood the typechecker with errors. Turn on after a dedicated pass that
  // asserts `as Route` on runtime-built URLs.

  // Experimental performance features
  experimental: {
    // give upstream image fetches (e.g. ufs.sh) more time before "upstream image response timed out"
    imgOptTimeoutInSeconds: 30,
    // Optimized package imports: tree-shake and reduce bundle size
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "framer-motion",
      "date-fns",
      "class-variance-authority",
      "clsx",
      "sonner",
      "cmdk",
      "vaul",
      "zod",
    ],
    // Richer Web Vitals attribution shipped in Next.js 15.3+. Lets
    // `useReportWebVitals` (and our PostHog forwarder) see *which element*
    // caused an LCP / CLS regression instead of only the metric value —
    // makes performance debugging dramatically cheaper.
    webVitalsAttribution: ["CLS", "LCP", "INP", "FCP", "TTFB"],
  },

  async headers() {
    const corsForAdmin =
      process.env.NODE_ENV === "development"
        ? [
            {
              key: "Access-Control-Allow-Origin",
              value: "http://localhost:3001",
            },
          ]
        : [];

    return [
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
        // Cache static assets aggressively
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
        // Cache JS/CSS chunks; allow admin app (3001) to load fonts in dev (CORS)
        source: "/_next/static/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
        // Next.js sometimes serves media under /next/static (no leading _)
        source: "/next/static/:path*",
      },
      {
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // [SECURITY] Prevent clickjacking by disallowing framing (except Telegram WebApp)
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // [SECURITY] Enforce HTTPS with HSTS (2 years, include subdomains, allow preload)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // [SECURITY] Restrict browser feature access
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // [SECURITY] Content Security Policy — defence-in-depth against XSS
          {
            key: "Content-Security-Policy",
            value: (() => {
              const isDev = process.env.NODE_ENV !== "production";
              // 'unsafe-inline' is required for Next.js style injection + Tailwind runtime
              // hydration markers. 'unsafe-eval' is only needed for the dev HMR runtime
              // (and sideshift widget in dev); prod builds run without it. (h4)
              const scriptSrc = [
                "'self'",
                "'unsafe-inline'",
                isDev ? "'unsafe-eval'" : null,
                "https://telegram.org",
                "https://js.stripe.com",
                "https://sideshift.ai",
              ]
                .filter(Boolean)
                .join(" ");
              return [
                "default-src 'self'",
                `script-src ${scriptSrc}`,
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                "connect-src 'self' https: wss: https://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com",
                "frame-src 'self' https://js.stripe.com https://telegram.org https://oauth.telegram.org https://sideshift.ai",
                "frame-ancestors 'self'",
                "base-uri 'self'",
                "form-action 'self'",
              ].join("; ");
            })(),
          },
          // Preconnect to site-wide image/asset CDNs to reduce DNS+TLS latency.
          // Stripe (js.stripe.com) is intentionally NOT here: it's only
          // reachable from /checkout, so we issue the preconnect from the
          // checkout page via React 19's `preconnect()` API instead — every
          // non-checkout page saves the extra TLS handshake.
          {
            key: "Link",
            value: [
              "<https://utfs.io>; rel=preconnect",
              "<https://9qeynzupxi.ufs.sh>; rel=preconnect",
              "<https://images-api.printify.com>; rel=dns-prefetch",
              "<https://cdn.shopify.com>; rel=dns-prefetch",
              "<https://assets.coingecko.com>; rel=dns-prefetch",
            ].join(", "),
          },
          // Block crawlers on staging only (VERCEL_ENV=preview or STAGING=1)
          ...(process.env.VERCEL_ENV === "preview" ||
          process.env.STAGING === "1"
            ? [{ key: "X-Robots-Tag" as const, value: "noindex, nofollow" }]
            : []),
        ],
        // Security headers for all routes
        source: "/:path*",
      },
    ];
  },

  images: {
    // skip on-the-fly optimization in dev so images load faster on slow machines
    ...(process.env.NODE_ENV === "development" && { unoptimized: true }),
    // Optimize image loading with device sizes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    formats: ["image/avif", "image/webp"],
    // Include 192 and 320 so 138px/284px displays (e.g. category tiles, product grid) get appropriate srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 192, 256, 320, 384],
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com", protocol: "https" },
      { hostname: "raw.githubusercontent.com", protocol: "https" },
      { hostname: "lh3.googleusercontent.com", protocol: "https" },
      { hostname: "**.ufs.sh", protocol: "https" },
      { hostname: "images.unsplash.com", protocol: "https" },
      { hostname: "api.github.com", protocol: "https" },
      { hostname: "utfs.io", protocol: "https" },
      { hostname: "cdn.simpleicons.org", protocol: "https" },
      { hostname: "assets.coingecko.com", protocol: "https" },
      { hostname: "cryptologos.cc", protocol: "https" },
      { hostname: "upload.wikimedia.org", protocol: "https" },
      { hostname: "assets.stickpng.com", protocol: "https" },
      { hostname: "sui.io", protocol: "https" },
      { hostname: "pacsafe.com", protocol: "https" },
      { hostname: "cdn.shopify.com", protocol: "https" },
      // Printify product/mockup images (POD sync)
      { hostname: "images-api.printify.com", protocol: "https" },
      // Printful variant/mockup images (POD sync)
      { hostname: "files.cdnprintful.com", protocol: "https" },
      { hostname: "cdn.printful.com", protocol: "https" },
      // Cloudflare Images (e.g. Trezor seed data)
      { hostname: "imagedelivery.net", protocol: "https" },
      // Seeed Studio curated product images (seed + upload-curated)
      { hostname: "media-cdn.seeedstudio.com", protocol: "https" },
      // eSIM Card API: country flag icons
      { hostname: "flagcdn.com", protocol: "https" },
    ],
  },

  // Optimize production builds
  productionBrowserSourceMaps: false,

  async redirects() {
    const categoryRedirects = CATEGORY_REDIRECTS.map(
      ([source, destination]) => ({
        destination,
        permanent: true,
        source,
      }),
    );
    return [
      ...categoryRedirects,
      // Product URLs at base: /products/trezor-one → /trezor-one
      { destination: "/:path", permanent: true, source: "/products/:path" },
      // Support ticket URLs: legacy /dashboard/support/:id → /dashboard/support-tickets/:id
      {
        destination: "/dashboard/support-tickets/:id",
        permanent: true,
        source: "/dashboard/support/:id",
      },
    ];
  },

  // Webpack path (`next build --webpack`, used by scripts/conditional-build.ts fallback). Must
  // mirror turbopack.resolveAlias so WalletConnect / wagmi optional peers resolve on Railway.
  webpack: (webpackConfig) => {
    webpackConfig.resolve.fallback = {
      ...webpackConfig.resolve.fallback,
      "@safe-global/safe-apps-provider": false,
      "@safe-global/safe-apps-sdk": false,
      "pino-pretty": false,
      porto: false,
    };
    webpackConfig.resolve.alias = {
      ...webpackConfig.resolve.alias,
      "@base-org/account": wagmiStub,
      "@coinbase/wallet-sdk": wagmiStub,
      "@gemini-wallet/core": wagmiStub,
      "@metamask/connect-evm": wagmiStub,
      "@walletconnect/ethereum-provider": resolveWalletConnect(),
      accounts: wagmiStub,
    };
    return webpackConfig;
  },

  // Optional wagmi connectors + pino: alias/stub so build always resolves (Railway, strict installs)
  turbopack: {
    resolveAlias: {
      "@base-org/account": wagmiStub,
      "@coinbase/wallet-sdk": wagmiStub,
      "@gemini-wallet/core": wagmiStub,
      "@metamask/connect-evm": wagmiStub,
      "@safe-global/safe-apps-provider": emptyModuleStub,
      "@safe-global/safe-apps-sdk": emptyModuleStub,
      "@walletconnect/ethereum-provider": resolveWalletConnect(),
      // @wagmi/core tempo connectors use dynamic import('accounts'); resolve optional peer.
      accounts: wagmiStub,
      "pino-pretty": emptyModuleStub,
      porto: emptyModuleStub,
    },
    // Avoid monorepo lockfile root mis-detection warnings in CI/build output.
    root: process.cwd(),
  },
} as NextConfig;

const shouldAnalyze = process.env.ANALYZE === "true";
const withBundleAnalyzer = createBundleAnalyzer({
  enabled: true,
});

// Important: when disabled, avoid wrapping config at all.
// The wrapper can still inject a webpack hook shape that makes Next 16 treat
// the config as webpack-customized, which blocks default Turbopack builds.
export default shouldAnalyze ? withBundleAnalyzer(config) : config;
