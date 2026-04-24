"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { toast } from "sonner";

import { trackViewItemList } from "~/lib/analytics/ecommerce";
import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { ProductGridSkeleton } from "~/ui/components/product-card-skeleton";
import { Button } from "~/ui/primitives/button";

const ProductQuickView = dynamic(
  () =>
    import("~/ui/components/product-quick-view").then((m) => ({
      default: m.ProductQuickView,
    })),
  { ssr: false },
);

interface Product {
  category: string;
  createdAt?: string;
  hasVariants?: boolean;
  id: string;
  image: string;
  images?: string[];
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  slug?: string;
  tokenGated?: boolean;
  tokenGatePassed?: boolean;
}

const limit = 24;

export function BrandProductsClient({
  brandSlug,
  initialPage,
  initialProducts,
  initialTotalPages,
}: {
  brandSlug: string;
  initialPage: number;
  initialProducts: Product[];
  initialTotalPages: number;
}) {
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();
  const [products, setProducts] = React.useState(initialProducts);
  const [page, setPage] = React.useState(initialPage);
  const [totalPages, setTotalPages] = React.useState(initialTotalPages);
  const [loading, setLoading] = React.useState(false);
  const [quickSlug, setQuickSlug] = React.useState<null | string>(null);

  const listFired = React.useRef(false);
  React.useEffect(() => {
    if (listFired.current) return;
    listFired.current = true;
    trackViewItemList({
      itemCount: initialProducts.length,
      listId: `brand:${brandSlug}`,
      listName: `Brand: ${brandSlug}`,
    });
  }, [brandSlug, initialProducts.length]);

  const fetchPage = React.useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          brandSlug,
          forStorefront: "1",
          limit: String(limit),
          page: String(nextPage),
          sort: "newest",
        });
        const res = await fetch(`/api/products?${params}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load products");
        const data = (await res.json()) as {
          items?: Product[];
          total?: number;
          totalPages?: number;
        };
        const mapped = (data.items ?? []).map((p) => ({
          ...p,
          inStock: p.inStock ?? true,
          rating: p.rating ?? 0,
        }));
        setProducts((prev) => {
          if (!append) return mapped;
          const seen = new Set(prev.map((p) => p.id));
          const extra = mapped.filter((p) => !seen.has(p.id));
          return [...prev, ...extra];
        });
        setTotalPages(data.totalPages ?? 1);
        setPage(nextPage);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [brandSlug],
  );

  const handleQuickView = React.useCallback((slugOrId: string) => {
    setQuickSlug(slugOrId);
  }, []);

  const handleAddToCart = React.useCallback(
    (productId: string) => {
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
    },
    [addItem, handleQuickView, products],
  );

  const handleAddToWishlist = React.useCallback(
    async (productId: string) => {
      const result = await addToWishlist(productId);
      if (result.ok) toast.success("Added to wishlist");
      else if (
        result.error === "Unauthorized" ||
        result.error?.toLowerCase().includes("sign in")
      ) {
        toast.error("Sign in to add to wishlist");
      } else toast.error(result.error ?? "Could not add to wishlist");
    },
    [addToWishlist],
  );

  const handleRemoveFromWishlist = React.useCallback(
    async (productId: string) => {
      const result = await removeFromWishlist(productId);
      if (result.ok) toast.success("Removed from wishlist");
      else toast.error(result.error ?? "Could not remove");
    },
    [removeFromWishlist],
  );

  return (
    <>
      {loading ? (
        <ProductGridSkeleton count={8} />
      ) : (
        <div
          className={`
            grid grid-cols-1 gap-6
            sm:grid-cols-2
            md:grid-cols-3
            lg:grid-cols-4
          `}
        >
          {products.map((product, index) => (
            <ProductCard
              isInWishlist={isInWishlist(product.id)}
              key={product.id}
              onAddToCart={handleAddToCart}
              onAddToWishlist={handleAddToWishlist}
              onQuickView={handleQuickView}
              onRemoveFromWishlist={handleRemoveFromWishlist}
              priority={index < 4}
              product={product}
            />
          ))}
        </div>
      )}

      {page < totalPages ? (
        <div className="mt-8 flex justify-center">
          <Button
            disabled={loading}
            onClick={() => void fetchPage(page + 1, true)}
            type="button"
            variant="outline"
          >
            Load more
          </Button>
        </div>
      ) : null}

      <ProductQuickView
        onOpenChange={(open) => !open && setQuickSlug(null)}
        open={Boolean(quickSlug)}
        productSlugOrId={quickSlug}
      />
    </>
  );
}
