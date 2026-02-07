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
  /** 1–5 star rating; shown when provided */
  rating?: number;
  text: string;
}

export function TestimonialCard({
  author,
  className,
  href,
  rating,
  text,
}: TestimonialCardProps) {
  const Card = href ? "a" : "div";
  const stars = Math.min(5, Math.max(0, Math.round(rating ?? 0)));

  return (
    <Card
      {...(href ? { href } : {})}
      className={cn(
        "flex flex-col rounded-lg border-t",
        "bg-gradient-to-b from-muted/50 to-muted/10",
        `
          p-4 text-start
          sm:p-6
        `,
        "hover:from-muted/60 hover:to-muted/20",
        `
          max-w-[320px]
          sm:max-w-[320px]
        `,
        "transition-colors duration-300",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {author.avatar ? (
          <img
            src={author.avatar}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h3 className="text-md leading-none font-semibold">{author.name}</h3>
          {rating != null && rating > 0 && (
            <div
              className="mt-1.5 flex items-center gap-0.5"
              aria-label={`${stars} out of 5 stars`}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-4 w-4",
                    i <= stars
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/40",
                  )}
                  aria-hidden
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <p
        className={`
          sm:text-md
          mt-4 text-sm text-muted-foreground
        `}
      >
        {text}
      </p>
    </Card>
  );
}
