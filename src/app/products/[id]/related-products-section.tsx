"use client";

import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";

export type RelatedProduct = {
  category: string;
  id: string;
  slug?: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
};

interface RelatedProductsSectionProps {
  products: RelatedProduct[];
}

export function RelatedProductsSection({
  products,
}: RelatedProductsSectionProps) {
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
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
    }
  };

  return (
    <section aria-labelledby="related-products-heading" className="mt-12">
      <h2
        id="related-products-heading"
        className="mb-6 text-2xl font-bold text-foreground"
      >
        Related Products
      </h2>
      {products.length === 0 ? (
        <p className="text-muted-foreground">No related products at the moment.</p>
      ) : (
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            isInWishlist={isInWishlist(product.id)}
            onAddToCart={handleAddToCart}
            onAddToWishlist={addToWishlist}
            onRemoveFromWishlist={removeFromWishlist}
            product={{
              ...product,
              inStock: product.inStock ?? true,
              rating: product.rating ?? 0,
            }}
          />
        ))}
        </div>
      </div>
      )}
    </section>
  );
}
