import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SEO_CONFIG } from "~/app";
import { getPublicSiteUrl } from "~/lib/app-url";
import { loadLpCampaignBundle } from "~/lib/lp/load-campaign-bundle";
import { cn } from "~/lib/cn";
import {
  PageContainer,
  PageSection,
} from "~/ui/components/layout/page-container";

import { LpMarkdownBody } from "./lp-markdown-body";
import {
  LpPrimaryCta,
  LpSecondaryCta,
  LpViewCapture,
} from "./lp-analytics-client";

const siteUrl = getPublicSiteUrl();

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const bundle = await loadLpCampaignBundle(slug);
  if (!bundle) {
    return { robots: { follow: false, index: false }, title: "Not found" };
  }
  return {
    description: bundle.description,
    openGraph: {
      description: bundle.description,
      title: bundle.title,
      type: "website",
      url: `${siteUrl}/lp/${slug}`,
    },
    robots: { follow: false, index: false },
    title: `${bundle.title} | ${SEO_CONFIG.fullName}`,
  };
}

export default async function LandingPage(props: PageProps) {
  const { slug } = await props.params;
  const bundle = await loadLpCampaignBundle(slug);
  if (!bundle) notFound();

  return (
    <div className="flex flex-col bg-background">
      <LpViewCapture slug={slug} />
      <PageSection
        className={`
          border-b border-border pb-16 pt-20
          md:pb-24 md:pt-28
        `}
        padding="none"
      >
        <PageContainer>
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={`
                mb-4 text-xs font-semibold tracking-[0.2em] text-muted-foreground
                uppercase
              `}
            >
              {bundle.heroEyebrow}
            </p>
            <h1
              className={cn(
                `
                  font-heading text-4xl font-bold tracking-tight text-foreground
                  md:text-5xl
                `,
              )}
            >
              {bundle.title}
            </h1>
            <p
              className={`
                mx-auto mt-6 max-w-xl text-lg text-muted-foreground
                md:text-xl
              `}
            >
              {bundle.description}
            </p>
            <div
              className={`
                mt-10 flex flex-col items-center justify-center gap-4
                sm:flex-row
              `}
            >
              <LpPrimaryCta href={bundle.primaryCtaHref} slug={slug}>
                {bundle.primaryCtaLabel}
              </LpPrimaryCta>
              {bundle.secondaryCtaHref && bundle.secondaryCtaLabel ? (
                <LpSecondaryCta href={bundle.secondaryCtaHref} slug={slug}>
                  {bundle.secondaryCtaLabel}
                </LpSecondaryCta>
              ) : null}
            </div>
            <p className="mt-8 text-xs text-muted-foreground">
              Prefer the full storefront?{" "}
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href="/"
              >
                Home
              </Link>
            </p>
          </div>
        </PageContainer>
      </PageSection>
      <PageSection className="py-12 md:py-16">
        <PageContainer>
          <LpMarkdownBody markdown={bundle.bodyMarkdown} />
        </PageContainer>
      </PageSection>
    </div>
  );
}
