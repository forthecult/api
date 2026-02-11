"use client";

import * as React from "react";
import { useCallback } from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { ProductQuickView } from "~/ui/components/product-quick-view";

type Product = {
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
};

export function FeaturedProductsSection({ products }: { products: Product[] }) {
  const { addItem } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [quickViewSlug, setQuickViewSlug] = React.useState<string | null>(null);

  const handleQuickView = useCallback((slugOrId: string) => {
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

  const handleAddToWishlist = useCallback(
    async (productId: string) => {
      const result = await addToWishlist(productId);
      if (result.ok) {
        toast.success("Added to wishlist");
      } else {
        if (
          result.error === "Unauthorized" ||
          result.error?.toLowerCase().includes("sign in")
        ) {
          toast.error("Sign in to add to wishlist");
        } else {
          toast.error(result.error ?? "Could not add to wishlist");
        }
      }
    },
    [addToWishlist],
  );

  const handleRemoveFromWishlist = useCallback(
    async (productId: string) => {
      const result = await removeFromWishlist(productId);
      if (result.ok) {
        toast.success("Removed from wishlist");
      } else {
        toast.error(result.error ?? "Could not remove from wishlist");
      }
    },
    [removeFromWishlist],
  );

  return (
    <>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          onAddToCart={handleAddToCart}
          onAddToWishlist={handleAddToWishlist}
          onRemoveFromWishlist={handleRemoveFromWishlist}
          onQuickView={handleQuickView}
          isInWishlist={isInWishlist(product.id)}
          product={product}
        />
      ))}

      <ProductQuickView
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        productSlugOrId={quickViewSlug}
      />
    </>
  );
}
