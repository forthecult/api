"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "~/lib/auth-client";
import { getAdminApiBaseUrl, getMainAppUrl } from "~/lib/env";

const STOREFRONT_SIGNIN_BASE = getMainAppUrl();

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!data?.user) {
      const signInUrl = `${STOREFRONT_SIGNIN_BASE}/auth/sign-in?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;
      window.location.href = signInUrl;
      return;
    }
    const apiBase = getAdminApiBaseUrl();
    fetch(`${apiBase}/api/admin/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403) {
          window.location.href = STOREFRONT_SIGNIN_BASE;
        }
      })
      .catch(() => {
        router.push("/");
      });
  }, [data?.user, isPending, router]);

  if (isPending || !data?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
