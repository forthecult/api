import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { POLICY_PAGE_CONTAINER_CLASS } from "~/lib/policy-page-layout";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/policies/shipping`,
  },
  description:
    "Culture's shipping policy. How we ship, when to expect your order, and where we deliver.",
  title: `Shipping | ${SEO_CONFIG.name}`,
};

export default function ShippingPolicyPage() {
  return (
    <div className={POLICY_PAGE_CONTAINER_CLASS}>
      <header className="mb-12 border-b border-border pb-10">
        <h1
          className={`
          text-3xl font-bold tracking-tight text-foreground
          sm:text-4xl
        `}
        >
          Shipping policy
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          We work with fulfillment partners to get your order to you as quickly
          as possible. Shipping options and costs are calculated at checkout.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: February 2026
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
            Processing and delivery times
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Most orders ship within 24 hours. Domestic orders typically arrive
            within 2–3 business days after shipping; international orders
            typically within about 2 weeks. During high-demand or peak seasons,
            processing and delivery may take longer—sometimes up to 2 weeks. We
            will do our best to keep you informed if there are delays.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Shipping costs and free shipping
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Shipping costs depend on your location and what you order. The best
            way to see your exact shipping cost is to add items to your cart and
            go to checkout—we calculate shipping there. Free shipping may apply
            for qualifying orders; any thresholds are shown at checkout.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Where we ship
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We ship to many countries. Availability and options depend on your
            address and the products in your order. We cannot ship to P.O.
            Boxes; please use a street address. If your country or address is
            not supported at checkout, we may not be able to fulfill orders
            there at this time.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Tracking
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Once your order ships, we will send you an email with tracking
            information so you can follow your delivery.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Returns and refunds
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you are not satisfied with your order, see our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/refund"
            >
              Refund policy
            </Link>{" "}
            for exchanges and refunds. We want you to be happy with your
            purchase.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Questions
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            For shipping questions or issues, use our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/contact"
            >
              contact page
            </Link>
            . We are here to help.
          </p>
        </section>
      </div>
    </div>
  );
}
