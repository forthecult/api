"use client";

import { cn } from "~/lib/cn";
import {
  type TestimonialAuthor,
  TestimonialCard,
} from "~/ui/primitives/testimonial";

interface TestimonialsSectionProps {
  className?: string;
  description: string;
  testimonials: {
    author: TestimonialAuthor;
    href?: string;
    productTitle?: string;
    rating?: number;
    text: string;
  }[];
  title: string;
}

export function TestimonialsSection({
  className,
  description,
  testimonials,
  title,
}: TestimonialsSectionProps) {
  return (
    <section
      className={cn(
        "bg-[#0D0D0D] text-[#F5F1EB]",
        `
          px-0 py-12
          sm:py-24
          md:py-32
        `,
        className,
      )}
    >
      <div
        className={`
          max-w-container mx-auto flex flex-col items-center gap-4 text-center
          sm:gap-16
        `}
      >
        <div
          className={`
            flex flex-col items-center gap-4 px-4
            sm:gap-8
          `}
        >
          <h2
            className={`
              font-heading max-w-[720px] text-3xl leading-tight font-bold
              text-[#F5F1EB]
              sm:text-5xl sm:leading-tight
            `}
          >
            {title}
          </h2>
          <p
            className={`
              text-md max-w-[600px] font-medium text-[#8A857E]
              sm:text-xl
            `}
          >
            {description}
          </p>
        </div>

        <div
          className={`
            marquee-edge-fade relative flex w-full flex-col items-center
            justify-center overflow-hidden
          `}
        >
          <div
            className={`
              group flex flex-row overflow-hidden p-2
              [gap:var(--gap)]
              [--gap:1rem]
            `}
          >
            <div
              className={`
                animate-marquee-testimonials flex shrink-0 flex-row
                justify-around
                [gap:var(--gap)]
              `}
            >
              {[...Array(2)].map((_, setIndex) =>
                testimonials.map((testimonial, i) => (
                  <TestimonialCard
                    author={testimonial.author}
                    href={testimonial.href}
                    key={`testimonial-${testimonial.author.name}-${setIndex}-${i}`}
                    productTitle={testimonial.productTitle}
                    rating={testimonial.rating}
                    text={testimonial.text}
                  />
                )),
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
