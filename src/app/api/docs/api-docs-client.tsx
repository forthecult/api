"use client";

import dynamic from "next/dynamic";

import "./api-docs-dark-overrides.css";

// Dynamic import: swagger-ui-react is ~500KB+ and only used on this page.
// The wrapper module statically imports the swagger-ui css alongside the react
// component, so both ship together in this route's async chunk rather than the
// main bundle.
const SwaggerUI = dynamic(
  () => import("./swagger-ui-wrapper").then((m) => m.default),
  {
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
  },
);

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
