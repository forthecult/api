import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";

import { ContactPageClient } from "./ContactPageClient";

const siteUrl = getPublicSiteUrl();

export const metadata = {
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  description: `Contact ${SEO_CONFIG.name}. Send a message or use our PGP key for private communication.`,
  title: `Contact Us | ${SEO_CONFIG.name}`,
};

export default function ContactPage() {
  const pgpPublicKey =
    process.env.CONTACT_PGP_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_CONTACT_PGP_PUBLIC_KEY ??
    "";

  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-12
        sm:px-6 sm:py-16
        lg:px-8
      `}
    >
      <header className="mb-12 border-b border-border pb-10">
        <h1
          className={`
            text-3xl font-bold tracking-tight text-foreground
            sm:text-4xl
          `}
        >
          Contact us
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Have a question or feedback? Send a message below, or use our PGP key
          for private, encrypted messages.
        </p>
      </header>

      <ContactPageClient pgpPublicKey={pgpPublicKey} />
    </div>
  );
}
