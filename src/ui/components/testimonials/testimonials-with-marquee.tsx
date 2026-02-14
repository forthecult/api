"use client";

import React from "react";

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
              font-heading max-w-[720px] text-3xl leading-tight font-bold text-[#F5F1EB]
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
            relative flex w-full flex-col items-center justify-center
            overflow-hidden
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
                flex shrink-0 flex-row justify-around
                animate-marquee-testimonials
                [gap:var(--gap)]
              `}
            >
              {[...Array(4)].map((_, setIndex) =>
                testimonials.map((testimonial, i) => (
                  <TestimonialCard
                    key={`testimonial-${testimonial.author.name}-${setIndex}-${i}`}
                    author={testimonial.author}
                    text={testimonial.text}
                    rating={testimonial.rating}
                    href={testimonial.href}
                  />
                )),
              )}
            </div>
          </div>

          <div
            className={`
              pointer-events-none absolute inset-y-0 left-0 hidden w-1/3
              bg-gradient-to-r from-background
              sm:block
            `}
          />
          <div
            className={`
              pointer-events-none absolute inset-y-0 right-0 hidden w-1/3
              bg-gradient-to-l from-background
              sm:block
            `}
          />
        </div>
      </div>
    </section>
  );
}
