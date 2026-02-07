"use client";

import Image from "next/image";
import { useState } from "react";

import { SEO_CONFIG } from "~/app";
import { cn } from "~/lib/cn";
import { Skeleton } from "~/ui/primitives/skeleton";

const DEFAULT_BACKGROUND =
  "https://images.unsplash.com/photo-1719811059181-09032aef07b8?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3";

interface AuthFormLayoutProps {
  children: React.ReactNode;
  backgroundImage?: string;
}

/**
 * Shared layout for auth pages (login, signup) with a split view:
 * - Left side: background image with brand overlay (gradient fallback when image fails)
 * - Right side: form content
 */
export function AuthFormLayout({
  children,
  backgroundImage = DEFAULT_BACKGROUND,
}: AuthFormLayoutProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="grid h-screen w-full max-w-[100vw] overflow-x-hidden md:grid-cols-2">
      {/* Left side - Image or gradient fallback */}
      <div className="relative hidden min-w-0 md:block">
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
            className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="absolute bottom-8 left-8 z-10 text-white">
          <h1 className="text-3xl font-bold">{SEO_CONFIG.name}</h1>
          <p className="mt-2 max-w-md text-sm text-white/80">
            {SEO_CONFIG.slogan}
          </p>
        </div>
      </div>

      {/* Right side - Form content */}
      <div className="flex min-w-0 items-center justify-center p-4 md:p-8">
        <div className="w-full min-w-0 max-w-md space-y-4">{children}</div>
      </div>
    </div>
  );
}

interface AuthFormHeaderProps {
  title: string;
  subtitle: string;
}

export function AuthFormHeader({ title, subtitle }: AuthFormHeaderProps) {
  return (
    <div className="space-y-4 text-center md:text-left">
      <h2 className="text-3xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

interface AuthFormDividerProps {
  text?: string;
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

/** Shared skeleton for login/signup dynamic loaders. Keeps layout identical to AuthFormLayout. */
export function AuthPageSkeleton({ formHeight = "h-64" }: { formHeight?: "h-64" | "h-80" }) {
  return (
    <div className="grid h-screen w-full max-w-[100vw] overflow-x-hidden md:grid-cols-2">
      <Skeleton className="hidden h-full min-w-0 md:block" />
      <div className="flex min-w-0 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-64" />
          <Skeleton className={cn("w-full rounded-lg", formHeight)} />
        </div>
      </div>
    </div>
  );
}
