import path from "node:path";

import type { NextConfig } from "next";

const wagmiStub = path.resolve(process.cwd(), "src/lib/wagmi-connector-stub.js");

function resolveWalletConnect(): string {
  try {
    return require.resolve("@walletconnect/ethereum-provider", {
      paths: [process.cwd()],
    });
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

  // Optimize production builds
  productionBrowserSourceMaps: false,

  // Experimental performance features
  experimental: {
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
        // Cache static assets aggressively
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
      },
      {
        // Cache JS/CSS chunks; allow admin app (3001) to load fonts in dev (CORS)
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
      },
      {
        // Next.js sometimes serves media under /next/static (no leading _)
        source: "/next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          ...corsForAdmin,
        ],
      },
      {
        // Security headers for all routes
        source: "/:path*",
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
            value: [
              "default-src 'self'",
              // 'unsafe-inline' required for Next.js style injection + Tailwind; 'unsafe-eval' for dev HMR (stripped by Next in prod)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: https://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com",
              "frame-src 'self' https://js.stripe.com https://telegram.org",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          // Preconnect to frequently-used image/asset CDNs to reduce DNS+TLS latency
          {
            key: "Link",
            value: [
              "<https://utfs.io>; rel=preconnect",
              "<https://images-api.printify.com>; rel=dns-prefetch",
              "<https://cdn.shopify.com>; rel=dns-prefetch",
              "<https://assets.coingecko.com>; rel=dns-prefetch",
            ].join(", "),
          },
          // Block crawlers on staging only (VERCEL_ENV=preview or STAGING=1)
          ...(process.env.VERCEL_ENV === "preview" || process.env.STAGING === "1"
            ? [{ key: "X-Robots-Tag" as const, value: "noindex, nofollow" }]
            : []),
        ],
      },
    ];
  },

  async redirects() {
    const categoryRedirects = CATEGORY_REDIRECTS.map(
      ([source, destination]) => ({
        source,
        destination,
        permanent: true,
      }),
    );
    return [
      ...categoryRedirects,
      // Product URLs at base: /products/trezor-one → /trezor-one
      { source: "/products/:path", destination: "/:path", permanent: true },
      // Support ticket URLs: legacy /dashboard/support/:id → /dashboard/support-tickets/:id
      {
        source: "/dashboard/support/:id",
        destination: "/dashboard/support-tickets/:id",
        permanent: true,
      },
    ];
  },

  // Optional wagmi connectors + pino: alias/stub so build always resolves (Railway, strict installs)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      porto: false,
      "@safe-global/safe-apps-provider": false,
      "@safe-global/safe-apps-sdk": false,
      "pino-pretty": false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account": wagmiStub,
      "@coinbase/wallet-sdk": wagmiStub,
      "@gemini-wallet/core": wagmiStub,
      "@walletconnect/ethereum-provider": resolveWalletConnect(),
    };
    return config;
  },

  images: {
    // skip on-the-fly optimization in dev so images load faster on slow machines
    ...(process.env.NODE_ENV === "development" && { unoptimized: true }),
    formats: ["image/avif", "image/webp"],
    // Optimize image loading with device sizes
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
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
      // Seeed Studio curated product images (seed + upload-curated)
      { hostname: "media-cdn.seeedstudio.com", protocol: "https" },
      // eSIM Card API: country flag icons
      { hostname: "flagcdn.com", protocol: "https" },
    ],
  },
} as NextConfig;

export default config;
