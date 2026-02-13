"use client";

import { cn } from "~/lib/cn";

/** Standard max-width container with responsive padding. Use for all customer-facing page content. */
const CONTAINER_CLASS =
  "container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn(CONTAINER_CLASS, className)}>{children}</div>
  );
}

export interface PageSectionProps {
  children: React.ReactNode;
  /** Section padding: "default" (py-12 md:py-16) or "none" */
  padding?: "default" | "none";
  /** Optional background, e.g. "muted" for bg-muted/50 */
  background?: "default" | "muted";
  className?: string;
  id?: string;
}

const SECTION_PADDING = "py-12 md:py-16";

export function PageSection({
  children,
  padding = "default",
  background = "default",
  className,
  id,
}: PageSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        padding === "default" && SECTION_PADDING,
        background === "muted" && "bg-muted/50",
        className,
      )}
    >
      {children}
    </section>
  );
}

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/** Consistent section title + optional subtitle for customer pages. */
export function SectionHeading({
  title,
  subtitle,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "mx-auto max-w-3xl space-y-4 text-center",
        className,
      )}
    >
      <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl dark:text-gradient-degen">
        {title}
      </h2>
      {subtitle ? (
        <p className="text-muted-foreground md:text-lg">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Section with centered heading block (title + accent line + description). Used on home for "Shop by category", "Featured Products", etc. */
export function SectionHeadingBlock({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col items-center text-center",
        className,
      )}
    >
      <h2 className="font-display text-3xl leading-tight font-bold tracking-tight md:text-4xl dark:text-gradient-degen">
        {title}
      </h2>
      <div className="mt-2 h-1 w-12 rounded-full bg-primary dark:bg-gradient-to-r dark:from-[#9945FF] dark:to-[#14F195]" />
      {description ? (
        <p className="mt-4 max-w-2xl text-center text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
