import { Suspense } from "react";

import { SEO_CONFIG } from "~/app";

import { LoginLoader } from "./login-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  description: `Sign in to your ${SEO_CONFIG.name} account.`,
  title: `Login | ${SEO_CONFIG.name}`,
};

/**
 * Login page - loads client component dynamically to avoid SSR overhead.
 * Session check and redirect handled client-side.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className={`
          flex min-h-[50vh] items-center justify-center text-muted-foreground
        `}
        >
          Loading…
        </div>
      }
    >
      <LoginLoader />
    </Suspense>
  );
}
