"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, ShoppingBag } from "lucide-react";

import { useCart } from "~/lib/hooks/use-cart";
import { ProductCard } from "~/ui/components/product-card";
import { Button } from "~/ui/primitives/button";

type Product = {
  id: string;
  name: string;
  image?: string;
  category?: string;
  price?: number;
  originalPrice?: number;
  inStock?: boolean;
  rating?: number;
};

type CategoryOption = { slug: string; name: string };

const LIMIT = 12;

function getAppUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function TelegramStoreClient() {
  const router = useRouter();
  const { addItem, itemCount, subtotal } = useCart();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([
    { slug: "all", name: "All" },
  ]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [tgReady, setTgReady] = React.useState(false);

  // Wait for Telegram Web App script and init
  React.useEffect(() => {
    const tg =
      typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (!tg) {
      setTgReady(true);
      return;
    }
    tg.ready();
    tg.expand();
    if (tg.themeParams?.bg_color) {
      tg.setHeaderColor(tg.themeParams.bg_color);
    }
    setTgReady(true);
  }, []);

  // MainButton: "View Cart ($X.XX)" -> /telegram/cart
  React.useEffect(() => {
    const tg =
      typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (!tg?.MainButton || !tgReady) return;

    const formatted =
      subtotal % 1 === 0 ? subtotal.toFixed(0) : subtotal.toFixed(2);
    tg.MainButton.setText(
      itemCount > 0 ? `View Cart ($${formatted})` : "View Cart",
    );
    tg.MainButton.show();

    const goToCart = () => {
      router.push("/telegram/cart");
    };
    tg.MainButton.onClick(goToCart);
    return () => {
      tg.MainButton.offClick(goToCart);
      tg.MainButton.hide();
    };
  }, [tgReady, itemCount, subtotal, router]);

  // BackButton: hide on store root
  React.useEffect(() => {
    const tg =
      typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    if (!tg?.BackButton) return;
    tg.BackButton.hide();
  }, [tgReady]);

  // Fetch products (same API as main site: page, limit, category slug)
  const fetchProducts = React.useCallback(
    (newPage: number, categorySlug: string, append: boolean) => {
      const base = getAppUrl();
      if (!base) return;
      const setLoadingState = append ? setLoadingMore : setLoading;
      setLoadingState(true);
      const params = new URLSearchParams({
        page: String(newPage),
        limit: String(LIMIT),
      });
      if (categorySlug !== "all") params.set("category", categorySlug);
      fetch(`${base}/api/products?${params}`)
        .then((res) => res.json())
        .then(
          (data: {
            items?: Product[];
            categories?: CategoryOption[];
            total?: number;
            totalPages?: number;
          }) => {
            const items = (data.items ?? []).map((p) => ({
              ...p,
              inStock: p.inStock ?? true,
              rating: p.rating ?? 0,
            }));
            if (append) {
              setProducts((prev) => [...prev, ...items]);
            } else {
              setProducts(items);
              if (data.categories && data.categories.length > 0) {
                setCategories([
                  { slug: "all", name: "All" },
                  ...data.categories,
                ]);
              }
            }
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 1);
          },
        )
        .catch(() => {
          if (!append) setProducts([]);
        })
        .finally(() => {
          setLoadingState(false);
        });
    },
    [],
  );

  // Initial load and when category changes
  React.useEffect(() => {
    setPage(1);
    fetchProducts(1, selectedCategory, false);
  }, [selectedCategory, fetchProducts]);

  const handleCategoryChange = React.useCallback((slug: string) => {
    setSelectedCategory(slug);
  }, []);

  const handleLoadMore = React.useCallback(() => {
    const nextPage = page + 1;
    if (nextPage > totalPages) return;
    setPage(nextPage);
    fetchProducts(nextPage, selectedCategory, true);
  }, [page, totalPages, selectedCategory, fetchProducts]);

  const handleAddToCart = React.useCallback(
    (product: Product, qty: number) => {
      addItem(
        {
          category: product.category ?? "Uncategorized",
          id: product.id,
          image: product.image ?? "/placeholder.svg",
          name: product.name,
          price: product.price ?? 0,
        },
        qty,
      );
    },
    [addItem],
  );

  const tg =
    typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const inTelegram = Boolean(tg?.initData);
  const hasMore = page < totalPages;

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-[var(--tg-theme-hint-color,#999)]/20 bg-[var(--tg-theme-bg-color,#fff)] px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            href="/telegram"
            className="font-semibold text-[var(--tg-theme-text-color,#000)]"
          >
            Culture
          </Link>
          {inTelegram ? null : (
            <p className="text-xs text-[var(--tg-theme-hint-color,#999)]">
              Open in Telegram for the full experience
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-6">
        <h1 className="mb-3 text-lg font-semibold text-[var(--tg-theme-text-color,#000)]">
          Products
        </h1>

        {/* Category strip: same data as main site, formatted for Telegram */}
        <div className="mb-4 overflow-x-auto pb-1">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => handleCategoryChange(cat.slug)}
                className={`
                  shrink-0 rounded-full px-3 py-1.5 text-sm font-medium
                  ${
                    cat.slug === selectedCategory
                      ? "bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]"
                      : "bg-[var(--tg-theme-secondary-bg-color,#eee)] text-[var(--tg-theme-text-color,#000)]"
                  }
                `}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-lg bg-[var(--tg-theme-secondary-bg-color,#eee)]"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-[var(--tg-theme-hint-color,#999)]">
            No products in this category.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{
                    category: p.category ?? "Uncategorized",
                    id: p.id,
                    image: p.image ?? "/placeholder.svg",
                    inStock: p.inStock ?? true,
                    name: p.name,
                    originalPrice: p.originalPrice,
                    price: p.price ?? 0,
                    rating: p.rating ?? 0,
                  }}
                  onAddToCart={() => handleAddToCart(p, 1)}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    "Loading…"
                  ) : (
                    <>
                      Load more
                      <ChevronRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 border-t border-[var(--tg-theme-hint-color,#999)]/20 pt-6">
          <Button
            variant="ghost"
            className="w-full text-sm text-[var(--tg-theme-hint-color,#999)]"
            asChild
          >
            <Link href="/products?source=telegram">
              <ShoppingBag className="mr-2 size-4" />
              Open full store in browser
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
