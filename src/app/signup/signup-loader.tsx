"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "~/ui/primitives/skeleton";

const SignupPageClient = dynamic(
  () => import("./page.client").then((m) => m.SignupPageClient),
  {
    loading: () => (
      <div className="grid h-screen w-screen md:grid-cols-2">
        <Skeleton className="hidden h-full md:block" />
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  },
);

export function SignupLoader() {
  return <SignupPageClient />;
}
