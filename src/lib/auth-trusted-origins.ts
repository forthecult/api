/**
 * Single source for Better Auth `trustedOrigins` and `/api/auth` CORS allowlist.
 * Origins are normalized (scheme + host, no trailing slash) so env typos like
 * `https://admin.example/` still match browser `Origin` headers.
 */

import { getPublicSiteUrl } from "~/lib/app-url";

export function getCorsAllowedAuthOrigins(): string[] {
  if (process.env.NODE_ENV === "development") {
    return getDevelopmentAuthOrigins();
  }
  return getProductionAuthOrigins();
}

export function getDevelopmentAuthOrigins(): string[] {
  return [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
}

export function getProductionAuthOrigins(): string[] {
  const set = new Set<string>();
  const push = (v: string | undefined) => {
    const n = normalizeWebOrigin(v);
    if (n) set.add(n);
  };
  // Must match browser Origin for credentialed /api/auth calls. Include the same
  // canonical URL as emails/metadata (`getPublicSiteUrl` defaults when env is unset).
  push(getPublicSiteUrl());
  push(process.env.NEXT_PUBLIC_APP_URL);
  push(process.env.NEXT_PUBLIC_ADMIN_APP_URL);
  push(process.env.NEXT_SERVER_APP_URL);
  for (const o of parseCommaSeparatedOrigins(
    process.env.AUTH_EXTRA_TRUSTED_ORIGINS,
  )) {
    set.add(o);
  }
  if (process.env.VERCEL_URL?.trim()) {
    push(`https://${process.env.VERCEL_URL.trim()}`);
  }
  const railwayPublic = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayPublic) {
    push(
      /^https?:\/\//i.test(railwayPublic)
        ? railwayPublic
        : `https://${railwayPublic}`,
    );
  }
  return [...set];
}

export function isAllowedAuthCorsOrigin(requestOrigin: null | string): boolean {
  if (!requestOrigin) return false;
  const norm = normalizeWebOrigin(requestOrigin);
  return getCorsAllowedAuthOrigins().includes(norm);
}

export function normalizeWebOrigin(value: string | undefined): string {
  if (!value?.trim()) return "";
  let s = value.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, "")}`;
  }
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/+$/, "");
  }
}

export function parseCommaSeparatedOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => normalizeWebOrigin(part.trim()))
    .filter(Boolean);
}
