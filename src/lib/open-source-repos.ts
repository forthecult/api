/**
 * Public GitHub links for /open-source. Override via NEXT_PUBLIC_* in .env.local.
 */

export type OpenSourceArea = "ai" | "mobile" | "smartContracts" | "website";

export function getOpenSourceLinks(): Record<
  OpenSourceArea,
  { description: string; href: string; label: string }
> {
  return {
    ai: {
      description:
        "Storefront AI chat, Venice integration, RAG pipeline, and admin tooling.",
      href:
        process.env.NEXT_PUBLIC_GITHUB_AI?.trim() ||
        "https://github.com/forthecult/webapp",
      label: "AI & chat",
    },
    mobile: {
      description:
        "Native apps and mobile experiences when published — track the repo for releases.",
      href:
        process.env.NEXT_PUBLIC_GITHUB_MOBILE?.trim() ||
        "https://github.com/forthecult",
      label: "Mobile",
    },
    smartContracts: {
      description:
        "On-chain programs, token logic, and integration contracts.",
      href:
        process.env.NEXT_PUBLIC_GITHUB_SMART_CONTRACTS?.trim() ||
        "https://github.com/forthecult",
      label: "Smart contracts",
    },
    website: {
      description:
        "Next.js storefront, checkout, membership, and customer-facing UI.",
      href:
        process.env.NEXT_PUBLIC_GITHUB_WEBSITE?.trim() ||
        "https://github.com/forthecult/webapp",
      label: "Website & store",
    },
  };
}
