"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "~/lib/auth-client";

const MAIN_APP =
  typeof process.env.NEXT_PUBLIC_MAIN_APP_URL === "string"
    ? process.env.NEXT_PUBLIC_MAIN_APP_URL
    : "http://localhost:3000";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!data?.user) {
      const signInUrl = `${MAIN_APP}/auth/sign-in?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`;
      window.location.href = signInUrl;
      return;
    }
    fetch(`${MAIN_APP}/api/admin/me`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403) {
          window.location.href = MAIN_APP;
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
