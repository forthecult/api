import Link from "next/link";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/policies/privacy`,
  },
  description:
    "Culture's privacy policy. We collect only what we need, use it responsibly, and never sell your data. Your privacy matters to us.",
  title: `Privacy policy | ${SEO_CONFIG.name}`,
};

export default function PrivacyPolicyPage() {
  return (
    <div
      className={`
      container mx-auto max-w-2xl px-4 py-12
      sm:py-16
    `}
    >
      <header className="mb-12 border-b border-border pb-10">
        <h1
          className={`
          text-3xl font-bold tracking-tight text-foreground
          sm:text-4xl
        `}
        >
          Privacy policy
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Your privacy matters to us. We collect only what we need to run the
          store, use it responsibly, and never sell your data.
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
            Our commitment to you
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Culture is built with customer privacy at the center. We don&apos;t
            track you across the web, we don&apos;t sell your information to
            advertisers or data brokers, and we keep only what&apos;s necessary
            to serve you—orders, account, and support. We believe that&apos;s
            how it should be.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Information we collect
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We collect only what we need to provide and improve our services:
          </p>
          <ul className="mt-3 space-y-4 text-muted-foreground" role="list">
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="min-w-0">
                <strong className="block font-medium text-foreground">
                  Contact & account:
                </strong>
                <span className="mt-0.5 block">
                  name, email, password (hashed), and optional profile details
                  you provide.
                </span>
              </span>
            </li>
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="min-w-0">
                <strong className="block font-medium text-foreground">
                  Orders & shipping:
                </strong>
                <span className="mt-0.5 block">
                  billing and shipping addresses, phone (if provided), and order
                  history.
                </span>
              </span>
            </li>
            <li className="flex gap-2 leading-relaxed">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="min-w-0">
                <strong className="block font-medium text-foreground">
                  Usage data:
                </strong>
                <span className="mt-0.5 block">
                  basic technical data (e.g. IP, device type) for security,
                  fraud prevention, and making the site work. We do not use this
                  for cross-site tracking or advertising.
                </span>
              </span>
            </li>
          </ul>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            How we use your information
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We use your information to process orders, manage your account, send
            order and account-related emails, prevent fraud, comply with law,
            and improve our services. We do not use your data for targeted
            advertising or to infer characteristics about you beyond what you
            explicitly provide.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Cookies and similar technologies
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We use only{" "}
            <strong className="font-medium text-foreground">
              essential cookies
            </strong>
            —for sign-in, cart, security, and load balancing. We do not use
            advertising cookies, cross-site trackers, or non-essential analytics
            that follow you around the web. That&apos;s why we don&apos;t show a
            cookie consent banner: we don&apos;t use the kind that require one.
            For more detail, see our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/cookies"
            >
              Cookies policy
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
            Sharing and disclosure
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We share data only when necessary: with payment and fulfillment
            partners to process orders, with service providers who help us run
            the site (under strict confidentiality), and when required by law or
            to protect rights and safety. We do not sell or rent your personal
            information.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Your rights and choices
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Depending on where you live, you may have the right to access,
            correct, delete, or port your data, and to opt out of certain
            processing. You can update your account and preferences in your
            account settings. To exercise other rights (e.g. deletion, access),
            contact us using the details below. We will not discriminate against
            you for exercising your privacy rights. If you are in the EEA/UK,
            you may also lodge a complaint with your local data protection
            authority.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Security and retention
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            We use reasonable technical and organizational measures to protect
            your data. No system is perfectly secure; we do not guarantee
            absolute security. We retain your information only as long as needed
            to provide services, comply with law, and resolve disputes.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Children, international use, and changes
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Our services are not directed at children; we do not knowingly
            collect children&apos;s data. If you are outside our primary
            jurisdiction, your data may be transferred and processed in other
            countries; we rely on appropriate safeguards where required. We may
            update this policy from time to time; we will post the revised
            version and update the &quot;Last updated&quot; date. Continued use
            after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section
          className={`
          rounded-lg border border-border bg-card/50 px-5 py-5
          sm:px-6
        `}
        >
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Contact us
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            For privacy questions, to exercise your rights, or to report a
            concern, please use our{" "}
            <Link
              className={`
                font-medium text-primary underline-offset-4
                hover:underline
              `}
              href="/contact"
            >
              contact page
            </Link>
            . We take your privacy seriously and will respond as required by
            applicable law.
          </p>
        </section>
      </div>
    </div>
  );
}
