"use client";

import { toast } from "sonner";

import { useCart } from "~/lib/hooks/use-cart";
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
    <>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          onAddToCart={handleAddToCart}
          product={product}
        />
      ))}
    </>
  );
}
