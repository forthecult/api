import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { POLICY_PAGE_CONTAINER_CLASS } from "~/lib/policy-page-layout";

import { RefundRequestForm } from "./RefundRequestForm";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/refund`,
  },
  description: `Request a refund. Enter your Order ID and email, payment address, or postal code to look up your order. Card and PayPal refunds are automated; crypto refunds are issued in stablecoin.`,
  title: `Request a refund | ${SEO_CONFIG.name}`,
};

export default function RefundPage() {
  return (
    <div className={POLICY_PAGE_CONTAINER_CLASS}>
      <header className="mb-10 border-b border-border pb-8">
        <h1
          className={`
            text-3xl font-bold tracking-tight text-foreground
            sm:text-4xl
          `}
        >
          Request a refund
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Use the form below to submit a refund request. You’ll need your Order
          ID (from your receipt or confirmation email). We’ll process your
          request and notify you on any channels you’ve chosen for transactional
          updates.
        </p>
      </header>

      <div className="space-y-10">
        <section
          className={`
            rounded-lg border border-border bg-card/50 px-5 py-5
            sm:px-6
          `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            How refunds work
          </h2>
          <ul
            className={`
              mt-3 list-inside list-disc space-y-2 leading-relaxed
              text-muted-foreground
            `}
          >
            <li>
              <strong className="font-medium text-foreground">
                Orders that haven’t shipped
              </strong>{" "}
              are cancelled immediately.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Credit/debit card and PayPal
              </strong>{" "}
              refunds are processed automatically and are typically instant once
              we approve your request.
            </li>
            <li>
              <strong className="font-medium text-foreground">
                Crypto refunds
              </strong>{" "}
              take a bit longer because we manually review and transfer funds.
              We’re working on automating this too. Onchain refunds are only
              made in{" "}
              <strong className="font-medium text-foreground">
                stablecoin
              </strong>{" "}
              (e.g. USDC) to the wallet address you provide—we do not refund in
              the original coin, unless it was a stablecoin.
            </li>
            <li>
              Once your refund is processed, we’ll send a notification to every
              channel you’ve requested for transactional updates (e.g. email,
              in-app).
            </li>
          </ul>
        </section>

        <RefundRequestForm />

        <p className="text-center text-sm text-muted-foreground">
          For full eligibility and return conditions, see our{" "}
          <Link
            className={`
              font-medium text-primary underline-offset-4
              hover:underline
            `}
            href="/policies/refund"
          >
            Refund policy
          </Link>
          . Need help?{" "}
          <Link
            className={`
              font-medium text-primary underline-offset-4
              hover:underline
            `}
            href="/contact"
          >
            Contact us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
