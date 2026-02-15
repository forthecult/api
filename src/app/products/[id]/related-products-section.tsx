"use client";

import * as React from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { ProductQuickView } from "~/ui/components/product-quick-view";

export interface RelatedProduct {
  category: string;
  hasVariants?: boolean;
  id: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  slug?: string;
  tokenGated?: boolean;
  tokenGatePassed?: boolean;
}

interface RelatedProductsSectionProps {
  products: RelatedProduct[];
}

export function RelatedProductsSection({
  products,
}: RelatedProductsSectionProps) {
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();

  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [quickViewSlug, setQuickViewSlug] = React.useState<null | string>(null);

  const handleQuickView = React.useCallback((slugOrId: string) => {
    setQuickViewSlug(slugOrId);
    setQuickViewOpen(true);
  }, []);

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (product.hasVariants) {
      handleQuickView(product.slug ?? product.id);
      return;
    }

    addItem(
      {
        category: product.category,
        id: product.id,
        image: product.image,
        name: product.name,
        price: product.price,
        ...(product.slug && { slug: product.slug }),
      },
      1,
    );
    toast.success(`${product.name} added to cart`);
  };

  return (
    <section
      aria-labelledby="related-products-heading"
      className="mt-12 flex w-full flex-col items-center pb-14"
    >
      <div
        className={`
        w-full max-w-7xl px-4
        sm:px-6
        lg:px-8
      `}
      >
        <h2
          className="mb-6 text-left text-2xl font-bold text-foreground"
          id="related-products-heading"
        >
          Related Products
        </h2>
        {products.length === 0 ? (
          <p className="text-muted-foreground">
            No related products at the moment.
          </p>
        ) : (
          <div
            className={`
            grid grid-cols-1 gap-x-8 gap-y-6
            sm:grid-cols-2 sm:gap-x-10
            md:grid-cols-3
            lg:grid-cols-4 lg:gap-x-12
          `}
          >
            {products.map((product) => (
              <ProductCard
                imageAspect="wide"
                isInWishlist={isInWishlist(product.id)}
                key={product.id}
                onAddToCart={handleAddToCart}
                onAddToWishlist={addToWishlist}
                onQuickView={handleQuickView}
                onRemoveFromWishlist={removeFromWishlist}
                product={{
                  ...product,
                  inStock: product.inStock ?? true,
                  rating: product.rating ?? 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ProductQuickView
        onOpenChange={setQuickViewOpen}
        open={quickViewOpen}
        productSlugOrId={quickViewSlug}
      />
    </section>
  );
}
