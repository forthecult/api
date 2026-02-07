"use client";

import dynamic from "next/dynamic";

import { AuthPageSkeleton } from "~/ui/components/auth/auth-form-layout";

const LoginPageClient = dynamic(
  () => import("./page.client").then((m) => m.LoginPageClient),
  {
    loading: () => <AuthPageSkeleton formHeight="h-64" />,
    ssr: false,
  },
);

export function LoginLoader() {
  return <LoginPageClient />;
}
