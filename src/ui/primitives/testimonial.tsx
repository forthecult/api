import { Star } from "lucide-react";

import { cn } from "~/lib/cn";

export interface TestimonialAuthor {
  avatar?: string;
  handle?: string;
  name: string;
}

export interface TestimonialCardProps {
  author: TestimonialAuthor;
  className?: string;
  href?: string;
  /** Product name/title for the review; shown when provided */
  productTitle?: string;
  /** 1–5 star rating; shown when provided */
  rating?: number;
  text: string;
}

export function TestimonialCard({
  author,
  className,
  href,
  productTitle,
  rating,
  text,
}: TestimonialCardProps) {
  const Card = href ? "a" : "div";
  const stars = Math.min(5, Math.max(0, Math.round(rating ?? 0)));

  return (
    <Card
      {...(href ? { href } : {})}
      className={cn(
        "flex flex-col rounded-lg border border-[#2A2A2A] bg-[#1A1A1A]",
        `
          p-4 text-start
          sm:p-6
        `,
        "hover:border-[#C4873A]/20 hover:bg-[#1E1E1E]",
        `
          max-w-[320px]
          sm:max-w-[320px]
        `,
        "transition-colors duration-300",
        className,
      )}
    >
      {productTitle && (
        <p
          className={`
          mb-3 text-xs font-medium tracking-wide text-[#8A857E] uppercase
        `}
        >
          {productTitle}
        </p>
      )}
      <div className="flex items-center gap-3">
        {author.avatar ? (
          <img
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
            src={author.avatar}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h3 className="text-md leading-none font-semibold text-[#F5F1EB]">
            {author.name}
          </h3>
          {rating != null && rating > 0 && (
            <div
              aria-label={`${stars} out of 5 stars`}
              className="mt-1.5 flex items-center gap-0.5"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  aria-hidden
                  className={cn(
                    "h-4 w-4",
                    i <= stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40",
                  )}
                  key={i}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <p
        className={`
          sm:text-md
          mt-4 text-sm text-[#8A857E]
        `}
      >
        {text}
      </p>
    </Card>
  );
}
