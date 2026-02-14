import { cn } from "~/lib/cn";

import { CartClient } from "./cart-client";

export interface CartItem {
  category: string;
  id: string;
  image: string;
  name: string;
  price: number;
  quantity: number;
  /** Product slug for URL (store.com/[slug]). Optional. */
  slug?: string;
  /** Product id for checkout; for variant lines same as the product. */
  productId?: string;
  /** Variant id when adding a product variant to cart. */
  productVariantId?: string;
  /** Human-readable variant (e.g. "Medium", "iPhone 16 Pro") for display in cart/checkout. */
  variantLabel?: string;
  /** True for digital products (eSIM, downloads) — skip shipping at checkout */
  digital?: boolean;
  /** eSIM-specific: package ID from reseller API */
  esimPackageId?: string;
  /** eSIM-specific: package type */
  esimPackageType?: string;
}

interface CartProps {
  className?: string;
}

export function Cart({ className }: CartProps) {
  return (
    <div className={cn("relative", className)}>
      <CartClient className={className} />
    </div>
  );
}
