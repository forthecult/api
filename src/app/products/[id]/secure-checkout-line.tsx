"use client";

import Image from "next/image";

import { getPaymentIconPaths } from "~/lib/checkout-payment-options";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";

export function SecureCheckoutLine() {
  const { visibility } = usePaymentMethodSettings();
  const icons = getPaymentIconPaths(visibility);

  return (
    <div className="mb-6 block w-full">
      {/* Centered with Add to Cart: block + mx-auto + w-fit so content centers in full-width row */}
      <div
        className="mx-auto w-fit flex flex-wrap items-center justify-center gap-x-8 gap-y-1 text-sm text-muted-foreground sm:gap-x-12"
        role="list"
        aria-label="Purchase assurances"
      >
        <span role="listitem">🔒 Secure Checkout</span>
        <span aria-hidden className="select-none text-muted-foreground/70">
          |
        </span>
        <span role="listitem">↩️ 30-Day Returns</span>
        <span aria-hidden className="select-none text-muted-foreground/70">
          |
        </span>
        <span role="listitem">🚚 Ships in 2-5 Days</span>
      </div>
      {icons.length > 0 && (
        <div className="mx-auto mt-2 w-fit flex flex-wrap items-center justify-center gap-2">
          {icons.map(({ src, alt }) => (
            <span
              key={src + alt}
              className="relative flex h-4 w-5 shrink-0 items-center justify-center"
              title={alt}
            >
              <Image
                alt={alt}
                className="object-contain"
                height={17}
                src={src}
                width={22}
                unoptimized={src.endsWith(".svg")}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
