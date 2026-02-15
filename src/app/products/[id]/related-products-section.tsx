"use client";

import * as React from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { ProductQuickView } from "~/ui/components/product-quick-view";

export type RelatedProduct = {
  category: string;
  hasVariants?: boolean;
  id: string;
  slug?: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  tokenGated?: boolean;
  tokenGatePassed?: boolean;
};

interface RelatedProductsSectionProps {
  products: RelatedProduct[];
}

export function RelatedProductsSection({
  products,
}: RelatedProductsSectionProps) {
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [quickViewSlug, setQuickViewSlug] = React.useState<string | null>(null);

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
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="related-products-heading"
          className="mb-6 text-left text-2xl font-bold text-foreground"
        >
          Related Products
        </h2>
        {products.length === 0 ? (
          <p className="text-muted-foreground">
            No related products at the moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-x-10 lg:gap-x-12">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                imageAspect="wide"
                isInWishlist={isInWishlist(product.id)}
                onAddToCart={handleAddToCart}
                onAddToWishlist={addToWishlist}
                onRemoveFromWishlist={removeFromWishlist}
                onQuickView={handleQuickView}
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
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        productSlugOrId={quickViewSlug}
      />
    </section>
  );
}
