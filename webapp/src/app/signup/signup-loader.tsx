"use client";

import dynamic from "next/dynamic";

import { AuthPageSkeleton } from "~/ui/components/auth/auth-form-layout";

const SignupPageClient = dynamic(
  () => import("./page.client").then((m) => m.SignupPageClient),
  {
    loading: () => <AuthPageSkeleton formHeight="h-80" />,
    ssr: false,
  },
);

export function SignupLoader() {
  return <SignupPageClient />;
}
