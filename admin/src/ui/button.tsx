import * as React from "react";

import { cn } from "~/lib/cn";

const buttonVariants = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent",
  outline:
    "border border-input bg-background hover:bg-muted hover:text-muted-foreground",
  ghost: "hover:bg-muted hover:text-muted-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const buttonSizes = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-9 w-9",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  asChild?: boolean;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const baseClass = cn(
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
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
