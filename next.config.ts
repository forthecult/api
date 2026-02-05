import type { NextConfig } from "next";

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
    ];
  },

  // Suppress optional/peer dependency resolution (wagmi, WalletConnect/pino)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      porto: false,
      "@safe-global/safe-apps-provider": false,
      "@safe-global/safe-apps-sdk": false,
      // pino (from @walletconnect/logger) optionally uses pino-pretty; we don't need it in the bundle
      "pino-pretty": false,
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
      { hostname: "**.githubassets.com", protocol: "https" },
      { hostname: "**.githubusercontent.com", protocol: "https" },
      { hostname: "**.googleusercontent.com", protocol: "https" },
      { hostname: "**.ufs.sh", protocol: "https" },
      { hostname: "**.unsplash.com", protocol: "https" },
      { hostname: "api.github.com", protocol: "https" },
      { hostname: "utfs.io", protocol: "https" },
      { hostname: "cdn.simpleicons.org", protocol: "https" },
      { hostname: "assets.coingecko.com", protocol: "https" },
      { hostname: "cryptologos.cc", protocol: "https" },
      { hostname: "upload.wikimedia.org", protocol: "https" },
      { hostname: "assets.stickpng.com", protocol: "https" },
      { hostname: "sui.io", protocol: "https" },
    ],
  },
} as NextConfig;

export default config;
