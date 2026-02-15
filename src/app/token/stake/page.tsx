import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { StakeVoteClient } from "./StakeVoteClient";

export const metadata = {
  title: `Stake & Vote | CULT Token | ${SEO_CONFIG.name}`,
  description:
    "Stake your CULT token and participate in community governance. Vote on proposals for charity, products, and the future of the ecosystem.",
};

export default function TokenStakePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-muted/25 to-background">
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-muted-foreground">
            {SEO_CONFIG.name}
          </p>
          <h1
            className={`
              font-display text-3xl font-bold leading-tight tracking-tight
              text-foreground sm:text-4xl
            `}
          >
            <span
              className={`
                bg-gradient-to-r from-primary to-primary/70 bg-clip-text
                text-transparent
              `}
            >
              Stake &amp; Vote
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your CULT balance is your voting power. Connect your Solana wallet
            to participate.
          </p>
          <Link
            href="/token"
            className="mt-2 inline-block text-sm text-primary hover:underline"
          >
            ← Back to CULT token
          </Link>
        </div>
      </div>
      <StakeVoteClient />
    </div>
  );
}
