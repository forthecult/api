import type * as React from "react";

import { cn } from "~/lib/cn";

/**
 * React 19 passes `ref` as a regular prop for function components, so the
 * `forwardRef` wrapper we used pre-19 is redundant (and has been officially
 * deprecated by the React team). The external API is unchanged — consumers
 * still do `<Input ref={myRef} />`.
 */
function Input({
  className,
  ref,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        `
          flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent
          px-3 py-1 text-base transition-[color,box-shadow] outline-none
          selection:bg-primary selection:text-primary-foreground
          file:inline-flex file:h-7 file:border-0 file:bg-transparent
          file:text-sm file:font-medium file:text-foreground
          placeholder:text-muted-foreground
          disabled:pointer-events-none disabled:cursor-not-allowed
          disabled:opacity-50
          md:text-sm
          dark:bg-input/30
        `,
        `
          focus-visible:border-ring focus-visible:ring-[3px]
          focus-visible:ring-ring/50
        `,
        `
          aria-invalid:border-destructive aria-invalid:ring-destructive/20
          dark:aria-invalid:ring-destructive/40
        `,
        className,
      )}
      data-slot="input"
      ref={ref}
      type={type}
      {...props}
    />
  );
}

export { Input };
