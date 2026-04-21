"use client";

import { cn } from "~/lib/cn";

/** Standard max-width container with responsive padding. Use for all customer-facing page content. */
const CONTAINER_CLASS = "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageSectionProps {
  /** Optional background, e.g. "muted" for bg-muted/50 */
  background?: "default" | "muted";
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Section padding: "default" (py-12 md:py-16) or "none" */
  padding?: "default" | "none";
}

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn(CONTAINER_CLASS, className)}>{children}</div>;
}

const SECTION_PADDING = "py-12 md:py-16";

export interface SectionHeadingProps {
  className?: string;
  subtitle?: string;
  title: string;
}

export function PageSection({
  background = "default",
  children,
  className,
  id,
  padding = "default",
}: PageSectionProps) {
  return (
    <section
      className={cn(
        padding === "default" && SECTION_PADDING,
        background === "muted" && "bg-[#0D0D0D]",
        className,
      )}
      id={id}
    >
      {children}
    </section>
  );
}

/** Consistent section title + optional subtitle for customer pages. */
export function SectionHeading({
  className,
  subtitle,
  title,
}: SectionHeadingProps) {
  return (
    <div className={cn("mx-auto max-w-3xl space-y-4 text-center", className)}>
      <h2
        className={`
          font-heading text-2xl font-bold tracking-tight text-[#F5F1EB]
          md:text-3xl
        `}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`
            text-base text-muted-foreground
            md:text-lg
          `}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/** Section with centered heading block (title + accent line + description). Used on home for "Shop by category", "Featured Products", etc. */
export function SectionHeadingBlock({
  className,
  description,
  title,
}: {
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <div
      className={cn("mb-8 flex flex-col items-center text-center", className)}
    >
      <h2
        className={`
          font-heading text-3xl leading-tight font-bold tracking-tight
          text-[#F5F1EB]
          md:text-4xl
        `}
      >
        {title}
      </h2>
      <div
        className={`
          mt-2 h-0.5 w-16 bg-gradient-to-r from-[#C4873A] to-[#C4873A]/30
        `}
      />
      {description ? (
        <p
          className={`
            mt-4 max-w-2xl text-center text-base text-muted-foreground
            md:text-lg
          `}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
