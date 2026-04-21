"use client";

import { ChevronRight, ShoppingBag, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useCart } from "~/lib/hooks/use-cart";
import { ProductCard } from "~/ui/components/product-card";
import { Button } from "~/ui/primitives/button";

interface CategoryOption {
  name: string;
  slug: string;
}

interface Product {
  category?: string;
  id: string;
  image?: string;
  inStock?: boolean;
  name: string;
  originalPrice?: number;
  price?: number;
  rating?: number;
}

const LIMIT = 12;

export function TelegramStoreClient() {
  const router = useRouter();
  const { addItem, itemCount, subtotal } = useCart();
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([
    { name: "All", slug: "all" },
  ]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [_total, setTotal] = React.useState(0);
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
  }, []);

  // Fetch products (same API as main site: page, limit, category slug)
  const fetchProducts = React.useCallback(
    (newPage: number, categorySlug: string, append: boolean) => {
      const base = getAppUrl();
      if (!base) return;
      const setLoadingState = append ? setLoadingMore : setLoading;
      setLoadingState(true);
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page: String(newPage),
      });
      if (categorySlug !== "all") params.set("category", categorySlug);
      fetch(`${base}/api/products?${params}`)
        .then((res) => res.json())
        .then((raw: unknown) => {
          const data = raw as {
            categories?: CategoryOption[];
            items?: Product[];
            total?: number;
            totalPages?: number;
          };
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
              setCategories([{ name: "All", slug: "all" }, ...data.categories]);
            }
          }
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 1);
        })
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
      <header
        className={`
          sticky top-0 z-10 border-b border-[var(--tg-theme-hint-color,#999)]/20
          bg-[var(--tg-theme-bg-color,#fff)] px-4 py-3
        `}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--tg-theme-text-color,#000)]">
            Shop
          </span>
          {inTelegram ? (
            <Link
              aria-label={`Cart, ${itemCount} items`}
              className={`
                relative flex items-center justify-center rounded-full p-2
                text-[var(--tg-theme-text-color,#000)]
                hover:bg-[var(--tg-theme-hint-color,#999)]/10
              `}
              href="/telegram/cart"
            >
              <ShoppingCart className="size-6" />
              {itemCount > 0 ? (
                <span
                  className={`
                    absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center
                    justify-center rounded-full
                    bg-[var(--tg-theme-button-color,#3390ec)] px-1 text-[10px]
                    font-bold text-[var(--tg-theme-button-text-color,#fff)]
                  `}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </Link>
          ) : (
            <p className="text-xs text-[var(--tg-theme-hint-color,#999)]">
              Open in Telegram for the full experience
            </p>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-6">
        <h1
          className={`
            mb-3 text-lg font-semibold text-[var(--tg-theme-text-color,#000)]
          `}
        >
          Products
        </h1>

        {/* Category strip: same data as main site, formatted for Telegram */}
        <div className="mb-4 overflow-x-auto pb-1">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                className={`
                  shrink-0 rounded-full px-3 py-1.5 text-sm font-medium
                  ${
                    cat.slug === selectedCategory
                      ? `
                        bg-[var(--tg-theme-button-color,#3390ec)]
                        text-[var(--tg-theme-button-text-color,#fff)]
                      `
                      : `
                        bg-[var(--tg-theme-secondary-bg-color,#eee)]
                        text-[var(--tg-theme-text-color,#000)]
                      `
                  }
                `}
                key={cat.slug}
                onClick={() => handleCategoryChange(cat.slug)}
                type="button"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div
            className={`
              grid grid-cols-2 gap-4
              sm:grid-cols-3
            `}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                className={`
                  h-48 animate-pulse rounded-lg
                  bg-[var(--tg-theme-secondary-bg-color,#eee)]
                `}
                key={i}
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-[var(--tg-theme-hint-color,#999)]">
            No products in this category.
          </p>
        ) : (
          <>
            <div
              className={`
                grid grid-cols-2 gap-4
                sm:grid-cols-3
              `}
            >
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  onAddToCart={() => handleAddToCart(p, 1)}
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
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6">
                <Button
                  className="w-full"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  variant="outline"
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

        <div
          className={`
            mt-8 border-t border-[var(--tg-theme-hint-color,#999)]/20 pt-6
          `}
        >
          <Button
            asChild
            className="w-full text-sm text-[var(--tg-theme-hint-color,#999)]"
            variant="ghost"
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

function getAppUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}
