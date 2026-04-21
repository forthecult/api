/**
 * Public GitHub links for /open-source. Override via NEXT_PUBLIC_* in .env.local.
 */

export type OpenSourceArea = "ai" | "mobile" | "smartContracts" | "website";

export function getOpenSourceLinks(): Record<
  OpenSourceArea,
  {
    description: string;
    extended: string;
    highlights: string[];
    href: string;
    label: string;
  }
> {
  return {
    ai: {
      description:
        "Storefront AI chat, Venice integration, RAG pipeline, and admin tooling.",
      extended:
        "The same surfaces you use in production—streaming chat, character routing, retrieval over your data, and operator tools—are what we ship in the repo so you can diff behavior against claims.",
      highlights: [
        "API routes under /api/ai/*",
        "Prompt assembly & access control in src/lib/ai",
        "Dashboard hooks for agents and backups",
      ],
      href:
        process.env.NEXT_PUBLIC_GITHUB_AI?.trim() ||
        "https://github.com/forthecult/webapp",
      label: "AI & chat",
    },
    mobile: {
      description:
        "Native apps and mobile experiences when published — track the repo for releases.",
      extended:
        "When mobile clients ship, their source lands here first. Follow releases for TestFlight / Play tracks, deep links into the store, and wallet connect flows that match the web.",
      highlights: [
        "Release tags for store binaries",
        "Shared API contracts with the webapp",
        "Issue templates for mobile-specific bugs",
      ],
      href:
        process.env.NEXT_PUBLIC_GITHUB_MOBILE?.trim() ||
        "https://github.com/forthecult",
      label: "Mobile",
    },
    smartContracts: {
      description: "On-chain programs, token logic, and integration contracts.",
      extended:
        "Money-moving code deserves the same scrutiny as the storefront. Programs for staking, rewards, and checkout integrations are published so wallets and auditors can verify invariants.",
      highlights: [
        "Deploy scripts and IDL / ABIs",
        "Upgrade paths and multisig notes where applicable",
        "Integration tests against devnets",
      ],
      href:
        process.env.NEXT_PUBLIC_GITHUB_SMART_CONTRACTS?.trim() ||
        "https://github.com/forthecult",
      label: "Smart contracts",
    },
    website: {
      description:
        "Next.js storefront, checkout, membership, and customer-facing UI.",
      extended:
        "The marketing site, cart, crypto checkout, and account areas you interact with every day. This is the largest surface area—most of what you see in the browser is represented here.",
      highlights: [
        "App Router pages and layouts",
        "Checkout + payment integrations",
        "SEO, metadata, and content pipelines",
      ],
      href:
        process.env.NEXT_PUBLIC_GITHUB_WEBSITE?.trim() ||
        "https://github.com/forthecult/webapp",
      label: "Website & store",
    },
  };
}
