"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

import "./api-docs-dark-overrides.css";

// Dynamic import: swagger-ui-react is ~500KB+ and only used on this page.
// Loading it lazily keeps it out of the main bundle entirely.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  loading: () => (
    <div
      className={`
        flex min-h-screen items-center justify-center bg-[#fafafa]
        dark:bg-[#1a1a1a]
      `}
    >
      <div
        className={`
          h-8 w-8 animate-spin rounded-full border-4 border-primary
          border-t-transparent
        `}
      />
    </div>
  ),
  ssr: false,
});

export default function ApiDocsClient() {
  return (
    <div
      className={`
        api-docs-wrapper min-h-screen bg-[#fafafa]
        dark:bg-[#1a1a1a]
      `}
    >
      <SwaggerUI url="/api/openapi.json" />
    </div>
  );
}
