import Link from "next/link";

import { SEO_CONFIG } from "~/app";

export const metadata = {
  description:
    "Culture's refund policy. How to request a return or refund, eligibility, timing, and crypto refunds (issued in stablecoin).",
  title: `Refund policy | ${SEO_CONFIG.name}`,
};

export default function RefundPolicyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-12 border-b border-border pb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Refund policy
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We want you to be happy with your purchase. If you are not satisfied,
          we will process a return or refund when the request meets the
          conditions below.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: February 2026
        </p>
      </header>

      <div className="space-y-10">
        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Returns and eligibility
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You have{" "}
            <strong className="font-medium text-foreground">30 days</strong>{" "}
            from the date you receive your item to request a return. To be
            eligible, the item must be in the same condition as when you
            received it: unworn or unused, with tags, and in its original
            packaging. You will need the receipt or proof of purchase. Contact
            us first before sending anything back; we will send you a return
            shipping label and instructions. Items sent back without a prior
            approved return may not be accepted.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Damages and issues
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Please inspect your order when it arrives. If the item is defective,
            damaged, or you received the wrong item, contact us right away so we
            can evaluate and make it right.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Non-returnable items
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We cannot accept returns on: perishable goods (e.g. food); custom or
            personalized items; personal care or beauty products; downloadable
            software; gift cards; or sale items unless otherwise required by
            law. Other product types may be non-returnable; we will confirm when
            you contact us.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            eSIM refund eligibility
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            eSIM plans have different refund rules. Please review before
            purchasing.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="font-medium text-foreground">Instant refund:</strong>{" "}
              Only when there is a verified technical or install failure, or a
              supported carrier&apos;s network signal failure, and the eSIM has
              not been activated and has no data consumption.
            </li>
            <li>
              <strong className="font-medium text-foreground">Activated or used:</strong>{" "}
              Any eSIM that has been activated, partially used, or has data
              consumption is non-refundable. Once an eSIM connects to a network,
              it is considered delivered and consumed.
            </li>
            <li>
              <strong className="font-medium text-foreground">Unused eSIMs:</strong>{" "}
              If not activated, you may submit a refund request within{" "}
              <strong className="font-medium text-foreground">30 days</strong> of
              purchase. Requests after 30 days will not be approved.
            </li>
            <li>
              <strong className="font-medium text-foreground">Carrier &amp; network:</strong>{" "}
              No refund for country-wide shutdowns, temporary carrier outages, or
              local regulations affecting connectivity; service resumes when the
              network is available again.
            </li>
            <li>
              <strong className="font-medium text-foreground">Vodafone &amp; O2:</strong>{" "}
              Valid only in officially supported countries. Use outside those
              regions will disable the eSIM and no refund will be issued.
            </li>
            <li>
              <strong className="font-medium text-foreground">Voice &amp; SMS plans:</strong>{" "}
              All eSIM plans that include Voice and/or SMS are{" "}
              <strong className="font-medium text-foreground">non-refundable</strong>,{" "}
              regardless of activation or usage.
            </li>
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Exchanges
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The fastest way to get a different item is to request a return of
            the original item and, once the return is accepted, place a new
            order for the item you want.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            EU and UK right to cancel (14 days)
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you are in the European Union or the United Kingdom, you have the
            right to cancel your order within{" "}
            <strong className="font-medium text-foreground">14 days</strong> of
            receipt, for any reason and without justification. The same
            condition requirements apply (unworn/unused, tags, original
            packaging, proof of purchase). This right is in addition to our
            30-day return policy above and is provided in accordance with
            applicable consumer law.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Refunds
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            After we receive and inspect your return, we will notify you whether
            the refund is approved. If approved, we will refund the amount to
            your original payment method. Refunds typically appear within{" "}
            <strong className="font-medium text-foreground">
              10 business days
            </strong>{" "}
            of approval; your bank or payment provider may take additional time
            to post it. If more than 15 business days have passed since approval
            and you have not received the refund, contact us.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Crypto refunds
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you paid with cryptocurrency (e.g. Bitcoin, Ethereum, Solana), we
            can only issue your refund in{" "}
            <strong className="font-medium text-foreground">stablecoin</strong>.
            The refund amount will match the{" "}
            <strong className="font-medium text-foreground">
              dollar value
            </strong>{" "}
            of your purchase at the time you paid. For example: if you spent the
            equivalent of $200 in SOL and your refund is approved, you will
            receive $200 in USDC (or another stablecoin we support), not SOL. We
            will send the stablecoin to the wallet address you provide when we
            process the refund. Timing and network fees may vary; we will
            confirm details when we approve your return.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card/50 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Questions
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            To start a return or request a refund, use our{" "}
            <Link
              href="/refund"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              refund request page
            </Link>
            . For questions,{" "}
            <Link
              href="/contact"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              contact us
            </Link>
            . We are here to help.
          </p>
        </section>
      </div>
    </div>
  );
}
