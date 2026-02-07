"use client";

import { useCallback } from "react";
import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";

type Product = {
  category: string;
  id: string;
  image: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating?: number;
  slug?: string;
};

export function FeaturedProductsSection({ products }: { products: Product[] }) {
  const { addItem } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

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
          isInWishlist={isInWishlist(product.id)}
          product={product}
        />
      ))}
    </>
  );
}
