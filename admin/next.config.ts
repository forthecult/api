import type { NextConfig } from "next";

function storefrontApiOrigin(): null | string {
  const raw =
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  const withProto =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;
  return withProto.replace(/\/+$/, "");
}

const main = storefrontApiOrigin();

const nextConfig = {
  turbopack: { root: process.cwd() },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_ADMIN_API_RELATIVE === "0") return [];
    if (!main) return [];
    return [
      {
        destination: `${main}/api/:path*`,
        source: "/api/:path*",
      },
    ];
  },
} satisfies NextConfig;

export default nextConfig;
