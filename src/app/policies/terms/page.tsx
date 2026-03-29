import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { POLICY_PAGE_CONTAINER_CLASS } from "~/lib/policy-page-layout";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/policies/terms`,
  },
  description:
    "Terms of service for Culture. The rules that apply when you use our store and services.",
  title: `Terms of service | ${SEO_CONFIG.name}`,
};

export default function TermsOfServicePage() {
  return (
    <div className={POLICY_PAGE_CONTAINER_CLASS}>
      <header className="mb-12 border-b border-border pb-10">
        <h1
          className={`
          text-3xl font-bold tracking-tight text-foreground
          sm:text-4xl
        `}
        >
          Terms of service
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          By using Culture&apos;s website and services, you agree to these
          terms. Please read them before placing an order or creating an
          account.
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
            Agreement and acceptance
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            These terms (&quot;Terms&quot;) apply to your use of the Culture
            website and services (&quot;Service&quot;). &quot;We,&quot;
            &quot;us,&quot; and &quot;our&quot; mean Culture. By visiting the
            site, creating an account, or making a purchase, you agree to these
            Terms and to our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/privacy"
            >
              Privacy policy
            </Link>
            ,{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/refund"
            >
              Refund policy
            </Link>
            , and{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/shipping"
            >
              Shipping policy
            </Link>
            . We may update these Terms by posting changes here; your continued
            use after changes constitutes acceptance.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Eligibility and acceptable use
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You must be at least the age of majority in your jurisdiction to use
            the Service. You may not use the Service for any illegal or
            unauthorized purpose, or in violation of any applicable laws
            (including intellectual property laws). You must not transmit
            malware or any code of a destructive nature. We may refuse service
            or terminate access at any time for breach of these Terms or for any
            other reason.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Orders and products
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Products and availability are subject to change. We reserve the
            right to limit quantities, refuse or cancel orders (e.g. in case of
            error, fraud, or policy violation), and discontinue products. We try
            to display product information and pricing accurately but do not
            guarantee that descriptions, images, or prices are error-free; we
            may correct errors and cancel orders affected by them. Returns and
            refunds are governed by our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/refund"
            >
              Refund policy
            </Link>
            .
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Pricing and payment
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Prices are in the currency shown at checkout and may change without
            notice. You agree to provide current, complete, and accurate payment
            and account information. We are not liable for price changes,
            suspension, or discontinuation of the Service.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Third-party tools and links
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The Service may include links to or integration with third-party
            sites, payment providers, or tools. We do not control and are not
            responsible for third-party content, privacy practices, or terms.
            Your use of third-party services is at your own risk. Complaints
            about third-party products or services should be directed to that
            third party.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            User content and feedback
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If you submit feedback, reviews, or other content to us, you grant
            us a non-exclusive right to use, display, and modify it in
            connection with the Service. You represent that your content does
            not violate any third-party rights or applicable law. We may remove
            content we deem unlawful or otherwise objectionable. We are not
            obligated to compensate you for or respond to submissions.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Personal information
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Your submission of personal information through the Service is
            governed by our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/policies/privacy"
            >
              Privacy policy
            </Link>
            .
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Prohibited uses
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You may not use the Service to: violate any law; infringe
            intellectual property or other rights; harass, abuse, or
            discriminate; submit false or misleading information; transmit
            malware or engage in phishing, scraping, or spam; collect
            others&apos; personal information without consent; or circumvent
            security features. We may terminate your access for any prohibited
            use.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Disclaimers and limitation of liability
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The Service and products are provided &quot;as is&quot; and &quot;as
            available.&quot; We do not warrant that the Service will be
            uninterrupted, error-free, or secure. To the fullest extent
            permitted by law, Culture and its affiliates, officers, employees,
            and agents are not liable for any indirect, incidental, special,
            consequential, or punitive damages (including lost profits or data)
            arising from your use of the Service or any product, even if advised
            of the possibility. Where law does not allow exclusion of certain
            warranties or limitations of liability, our liability is limited to
            the maximum extent permitted.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Indemnification
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You agree to indemnify and hold harmless Culture and its affiliates,
            officers, employees, and agents from any claims, damages, or
            expenses (including reasonable legal fees) arising from your breach
            of these Terms, your use of the Service, or your violation of any
            law or third-party rights.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Termination and survival
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            You may stop using the Service at any time. We may suspend or
            terminate your access without notice if we believe you have breached
            these Terms. Obligations that by their nature should survive (e.g.
            disclaimers, limitation of liability, indemnification) continue
            after termination.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Governing law and disputes
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            These Terms are governed by the laws of the United States, without
            regard to conflict-of-law principles. For any dispute, we encourage
            you to contact us first to seek an informal resolution. If that
            fails, any legal action shall be brought in the courts of competent
            jurisdiction as determined by applicable law. If you are in the
            European Union, you may also have rights under mandatory consumer
            protection laws of your country.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Severability and entire agreement
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            If any part of these Terms is held invalid or unenforceable, the
            remaining parts remain in effect. These Terms, together with the
            policies linked above, constitute the entire agreement between you
            and Culture regarding the Service and supersede any prior agreements
            or communications.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Contact
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Questions about these Terms? Use our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/contact"
            >
              contact page
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
