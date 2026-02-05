"use client";

import dynamic from "next/dynamic";

const ApiDocsClient = dynamic(() => import("./api-docs-client"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] dark:bg-[#1a1a1a]">
      <p className="text-muted-foreground">Loading API docs…</p>
    </div>
  ),
});

export default function ApiDocsPage() {
  return <ApiDocsClient />;
}
