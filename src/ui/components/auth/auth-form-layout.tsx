"use client";

import Image from "next/image";
import { useState } from "react";

import { SEO_CONFIG } from "~/app";
import { cn } from "~/lib/cn";
import { Skeleton } from "~/ui/primitives/skeleton";

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1719811059181-09032aef07b8?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3";

interface AuthFormDividerProps {
  text?: string;
}

interface AuthFormHeaderProps {
  /** Optional. When omitted, space is still reserved below the title. */
  subtitle?: string;
  title: string;
}

interface AuthFormLayoutProps {
  backgroundImage?: string;
  children: React.ReactNode;
}

export function AuthFormDivider({
  text = "Or continue with",
}: AuthFormDividerProps) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">{text}</span>
      </div>
    </div>
  );
}

export function AuthFormHeader({ subtitle, title }: AuthFormHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-1 text-center
        md:text-left
      `}
    >
      <h2
        className={`
          text-2xl font-bold
          sm:text-3xl
        `}
      >
        {title}
      </h2>
      <p className="min-h-[1.25rem] text-sm text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

/**
 * Shared layout for auth pages (login, signup) with a split view:
 * - Left side: background image with brand overlay (gradient fallback when image fails)
 * - Right side: form content
 */
export function AuthFormLayout({
  backgroundImage = DEFAULT_BACKGROUND,
  children,
}: AuthFormLayoutProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`
        grid h-screen w-full max-w-[100vw] overflow-hidden
        md:grid-cols-2
      `}
    >
      {/* Left side - Image or gradient fallback */}
      <div
        className={`
          relative hidden min-h-0 min-w-0
          md:block
        `}
      >
        {!imageError ? (
          <Image
            alt="Auth background image"
            className="object-cover"
            fill
            onError={() => setImageError(true)}
            priority
            sizes="(max-width: 768px) 0vw, 50vw"
            src={backgroundImage}
          />
        ) : (
          <div
            aria-hidden
            className={`
              absolute inset-0 bg-gradient-to-br from-primary/20 via-background
              to-primary/10
            `}
          />
        )}
        <div
          className={`
            absolute inset-0 bg-gradient-to-t from-background/80 to-transparent
          `}
        />
        <div className="absolute bottom-8 left-8 z-10 text-white">
          <h1 className="text-3xl font-bold">{SEO_CONFIG.name}</h1>
          <p className="mt-2 max-w-md text-sm text-white/80">
            {SEO_CONFIG.slogan}
          </p>
        </div>
      </div>

      {/* Right side - Form content: aligned to top so no scroll on laptop; compact spacing */}
      <div
        className={`
          flex min-h-0 min-w-0 items-start justify-center overflow-y-auto px-4
          py-6
          md:px-8 md:pt-10 md:pb-8
        `}
      >
        <div className="w-full max-w-md min-w-0 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Shared skeleton for login/signup dynamic loaders. Keeps layout identical to AuthFormLayout. */
export function AuthPageSkeleton({
  formHeight = "h-64",
}: {
  formHeight?: "h-64" | "h-80";
}) {
  return (
    <div
      className={`
        grid h-screen w-full max-w-[100vw] overflow-x-hidden
        md:grid-cols-2
      `}
    >
      <Skeleton
        className={`
          hidden h-full min-w-0
          md:block
        `}
      />
      <div className="flex min-w-0 items-center justify-center p-8">
        <div className="w-full max-w-md flex flex-col gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className={cn("w-full rounded-lg", formHeight)} />
        </div>
      </div>
    </div>
  );
}
