import type * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/cn";

const buttonVariants = cva(
  `
    inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm
    font-medium whitespace-nowrap transition-colors duration-200 ease-in-out
    outline-none
    focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60
    disabled:pointer-events-none disabled:opacity-50
    aria-invalid:border-destructive aria-invalid:ring-destructive/20
    dark:aria-invalid:ring-destructive/40
    [&_svg]:pointer-events-none [&_svg]:shrink-0
    [&_svg:not([class*='size-'])]:size-4
  `,
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: `
          h-9 px-4 py-2
          has-[>svg]:px-3
        `,
        icon: "size-9",
        lg: `
          h-10 rounded-md px-6
          has-[>svg]:px-4
        `,
        sm: `
          h-8 gap-1.5 rounded-md px-3
          has-[>svg]:px-2.5
        `,
      },
      variant: {
        default: `
          bg-[#C4873A] font-semibold text-[#111111]
          hover:bg-[#D4A05A]
          focus-visible:ring-2 focus-visible:ring-[#C4873A]/60
          active:bg-[#A8702F]
        `,
        destructive: `
          bg-destructive text-white
          hover:bg-destructive/90
          focus-visible:ring-2 focus-visible:ring-destructive/40
          dark:bg-destructive/60 dark:focus-visible:ring-destructive/40
        `,
        ghost: `
          hover:bg-muted hover:text-foreground
          focus-visible:ring-2 focus-visible:ring-primary/40
        `,
        link: `
          text-primary underline-offset-4
          hover:underline
          focus-visible:ring-2 focus-visible:ring-primary/40
        `,
        outline: `
          border border-border bg-transparent text-[#1A1611]
          hover:border-primary/50 hover:bg-muted hover:text-primary
          focus-visible:ring-2 focus-visible:ring-primary/40
          dark:text-[#F5F1EB]
        `,
        secondary: `
          bg-secondary text-secondary-foreground
          hover:bg-secondary/80
          focus-visible:ring-2 focus-visible:ring-secondary/40
        `,
      },
    },
  },
);

function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
