import * as React from "react";

import { cn } from "~/lib/cn";

const buttonVariants = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "hover:bg-muted hover:text-muted-foreground",
  outline:
    "border border-input bg-background hover:bg-muted hover:text-muted-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
};

const buttonSizes = {
  default: "h-9 px-4 py-2",
  icon: "h-9 w-9",
  sm: "h-8 rounded-md px-3 text-xs",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  size?: keyof typeof buttonSizes;
  variant?: keyof typeof buttonVariants;
};

export function Button({
  asChild = false,
  className,
  size = "default",
  variant = "default",
  ...props
}: ButtonProps) {
  const baseClass = cn(
    `
      inline-flex items-center justify-center rounded-md text-sm font-medium
      transition-colors
    `,
    "disabled:pointer-events-none disabled:opacity-50",
    "border border-transparent",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );

  if (asChild && React.Children.count(props.children) === 1) {
    const child = React.Children.only(props.children) as React.ReactElement<{
      className?: string;
    }>;
    return React.cloneElement(child, {
      className: cn(baseClass, child.props?.className),
    });
  }

  return <button className={baseClass} {...props} />;
}
