"use client";

import {
  ChevronLeft,
  ChevronRight,
  Home,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { trackViewItemList } from "~/lib/analytics/ecommerce";
import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { ProductGridSkeleton } from "~/ui/components/product-card-skeleton";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";

const ProductQuickView = dynamic(
  () =>
    import("~/ui/components/product-quick-view").then((m) => ({
      default: m.ProductQuickView,
    })),
  { ssr: false },
);

export type SortOption =
  | "best_selling"
  | "manual"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating";

interface BreadcrumbItem {
  href: string;
  name: string;
}

interface CategoryOption {
  /** Display image: category image or product fallback (not persisted). */
  image?: null | string;
  name: string;
  slug: string;
}

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

interface ProductsClientProps {
  /** Breadcrumbs for navigation context (optional, auto-generated if not provided). */
  breadcrumbs?: BreadcrumbItem[];
  /** Full category description (customer-facing, can be long) */
  categoryDescriptionFull?: string;
  description?: string;
  initialCategories: CategoryOption[];
  initialCategory: string;
  initialPage: number;
  initialProducts: Product[];
  /** Initial search query (for category pages) */
  initialSearch?: string;
  initialSort?: SortOption;
  initialSubcategory?: string;
  initialTotal: number;
  initialTotalPages: number;
  /** Child categories for subcategory filter (when on a category page) */
  subcategories?: CategoryOption[];
  /** For category pages: heading and subtext (default: "Products" / "Browse our latest...") */
  title?: string;
}

const SORT_LABELS: Record<SortOption, string> = {
  best_selling: "Best Selling",
  manual: "Recommended",
  newest: "Newest",
  price_asc: "Price (low to high)",
  price_desc: "Price (high to low)",
  rating: "Rating",
};

export function ProductsClient({
  breadcrumbs,
  categoryDescriptionFull,
  description = "Browse our latest products and find something you'll love.",
  initialCategories,
  initialCategory,
  initialPage,
  initialProducts,
  initialSearch = "",
  initialSort = "newest",
  initialSubcategory,
  initialTotal,
  initialTotalPages,
  subcategories = [],
  title = "Products",
}: ProductsClientProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { addToWishlist, isInWishlist, removeFromWishlist } = useWishlist();

  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [categories] = React.useState<CategoryOption[]>(initialCategories);
  const [page, setPage] = React.useState(initialPage);
  const [totalPages, setTotalPages] = React.useState(initialTotalPages);
  const [total, setTotal] = React.useState(initialTotal);
  const [selectedCategory, setSelectedCategory] =
    React.useState(initialCategory);
  const [sort, setSort] = React.useState<SortOption>(initialSort);
  const [selectedSubcategory, setSelectedSubcategory] = React.useState(
    initialSubcategory ?? "",
  );
  const [searchQuery, setSearchQuery] = React.useState(initialSearch);
  const [searchInput, setSearchInput] = React.useState(initialSearch);
  const [loading, setLoading] = React.useState(false);
  /** True when loading the next page via "Load More" (append mode). */
  const [loadingMore, setLoadingMore] = React.useState(false);
  /** When true, next sync from server props is skipped (we just did Load More and updated URL). */
  const skipNextSyncRef = React.useRef(false);

  // Quick View state; preload when grid in view or card hovered
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [quickViewSlug, setQuickViewSlug] = React.useState<null | string>(null);
  const [preloadQuickView, setPreloadQuickView] = React.useState(false);
  const productGridRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    trackViewItemList({
      itemCount: products.length,
      listId: selectedCategory,
      listName: title,
    });
  }, [products.length, selectedCategory, title]);

  React.useEffect(() => {
    const el = productGridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setPreloadQuickView(true);
      },
      { rootMargin: "100px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleQuickView = React.useCallback((slugOrId: string) => {
    setQuickViewSlug(slugOrId);
    setQuickViewOpen(true);
  }, []);

  const limit = 12;

  // Debounce search input into searchQuery
  React.useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const buildPath = React.useCallback(
    (opts: {
      category?: string;
      page?: number;
      q?: string;
      sort?: SortOption;
      subcategory?: string;
    }) => {
      const cat = opts.category ?? selectedCategory;
      const path = cat === "all" ? "/products" : `/${cat}`;
      const params = new URLSearchParams();
      const p = opts.page ?? page;
      const s = opts.sort ?? sort;
      const sub = opts.subcategory ?? selectedSubcategory;
      const searchQ = opts.q ?? searchQuery;
      if (p > 1) params.set("page", String(p));
      if (s !== "newest") params.set("sort", s);
      if (sub) params.set("subcategory", sub);
      if (searchQ) params.set("q", searchQ);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [selectedCategory, page, sort, selectedSubcategory, searchQuery],
  );

  const fetchProducts = React.useCallback(
    async (
      newPage: number,
      categorySlug: string,
      sortOption: SortOption,
      subcategorySlug: string,
      search = "",
      /** When true, appends results to the existing list instead of replacing. */
      append = false,
    ) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams({
          limit: String(limit),
          page: String(newPage),
          sort: sortOption,
        });
        if (categorySlug !== "all") params.set("category", categorySlug);
        else params.set("forStorefront", "1");
        if (subcategorySlug) params.set("subcategory", subcategorySlug);
        if (search.trim()) params.set("q", search.trim());

        const res = await fetch(`/api/products?${params}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load products");

        const data = (await res.json()) as {
          items?: Product[];
          total?: number;
          totalPages?: number;
        };

        const newItems = (data.items ?? []).map((p) => ({
          ...p,
          inStock: p.inStock ?? true,
          rating: p.rating ?? 0,
          tokenGatePassed:
            (p as { tokenGatePassed?: boolean }).tokenGatePassed ?? false,
        }));

        if (append) {
          setProducts((prev) => {
            // De-duplicate by id just in case
            const existingIds = new Set(prev.map((p) => p.id));
            const unique = newItems.filter((p) => !existingIds.has(p.id));
            return [...prev, ...unique];
          });
        } else {
          setProducts(newItems);
        }
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load products",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Sync state from server when URL page changes (e.g. user clicked Previous or landed on ?page=6)
  React.useEffect(() => {
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    setPage(initialPage);
    setProducts(initialProducts);
    setTotalPages(initialTotalPages);
    setTotal(initialTotal);
  }, [initialPage, initialTotal, initialTotalPages, initialProducts]);

  // When search query changes (user typed), go to page 1 and refetch
  const prevSearchRef = React.useRef(initialSearch);
  React.useEffect(() => {
    if (prevSearchRef.current === searchQuery) return;
    prevSearchRef.current = searchQuery;
    setPage(1);
    router.push(buildPath({ page: 1, q: searchQuery }), { scroll: false });
    fetchProducts(1, selectedCategory, sort, selectedSubcategory, searchQuery);
  }, [
    searchQuery,
    buildPath,
    selectedCategory,
    sort,
    selectedSubcategory,
    fetchProducts,
    router,
  ]);

  const handleCategoryChange = React.useCallback(
    (categorySlug: string) => {
      setSelectedCategory(categorySlug);
      setSelectedSubcategory("");
      setPage(1);
      const path = categorySlug === "all" ? "/products" : `/${categorySlug}`;
      router.push(`${path}?page=1`, { scroll: false });
      fetchProducts(1, categorySlug, sort, "", searchQuery);
    },
    [router, fetchProducts, sort, searchQuery],
  );

  const handleSortChange = React.useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      setPage(1);
      router.push(buildPath({ page: 1, sort: newSort }), { scroll: false });
      fetchProducts(
        1,
        selectedCategory,
        newSort,
        selectedSubcategory,
        searchQuery,
      );
    },
    [
      router,
      selectedCategory,
      selectedSubcategory,
      fetchProducts,
      buildPath,
      searchQuery,
    ],
  );

  const handleSubcategoryChange = React.useCallback(
    (subSlug: string) => {
      setSelectedSubcategory(subSlug);
      setPage(1);
      router.push(buildPath({ page: 1, subcategory: subSlug }), {
        scroll: false,
      });
      fetchProducts(1, selectedCategory, sort, subSlug, searchQuery);
    },
    [router, selectedCategory, sort, fetchProducts, buildPath, searchQuery],
  );

  const handleLoadMore = React.useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    skipNextSyncRef.current = true; // avoid overwriting accumulated list when server re-renders
    // Update URL to reflect page (crawlers can follow)
    router.push(buildPath({ page: nextPage }), { scroll: false });
    fetchProducts(
      nextPage,
      selectedCategory,
      sort,
      selectedSubcategory,
      searchQuery,
      true,
    );
  }, [
    page,
    router,
    selectedCategory,
    sort,
    selectedSubcategory,
    searchQuery,
    fetchProducts,
    buildPath,
  ]);

  const handlePreviousPage = React.useCallback(() => {
    if (page <= 1) return;
    router.push(buildPath({ page: page - 1 }), { scroll: false });
  }, [page, router, buildPath]);

  const handleAddToCart = React.useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // Products with variants need variant selection — open Quick View instead
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
    [addItem, products, handleQuickView],
  );

  const handleAddToWishlist = React.useCallback(
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

  const handleRemoveFromWishlist = React.useCallback(
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

  // Count active filters for indicator badge
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedCategory !== "all") count++;
    if (selectedSubcategory) count++;
    if (searchQuery) count++;
    if (sort !== "newest") count++;
    return count;
  }, [selectedCategory, selectedSubcategory, searchQuery, sort]);

  // Default breadcrumbs if none provided
  const breadcrumbItems = React.useMemo<BreadcrumbItem[]>(() => {
    if (breadcrumbs) return breadcrumbs;
    const items: BreadcrumbItem[] = [
      { href: "/", name: "Home" },
      { href: "/products", name: "Products" },
    ];
    if (selectedCategory !== "all") {
      const cat = categories.find((c) => c.slug === selectedCategory);
      if (cat) items.push({ href: `/${cat.slug}`, name: cat.name });
    }
    return items;
  }, [breadcrumbs, selectedCategory, categories]);

  return (
    <div className="flex min-h-screen flex-col">
      <main
        className={`
          flex-1 py-6
          sm:py-10
        `}
      >
        <div
          className={`
            mx-auto w-full max-w-7xl px-4
            sm:px-6
            lg:px-8
          `}
        >
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol
              className={`
                flex flex-wrap items-center gap-1 text-sm text-muted-foreground
              `}
            >
              {breadcrumbItems.map((item, i) => {
                const isLast = i === breadcrumbItems.length - 1;
                return (
                  <li
                    className="flex items-center gap-1"
                    key={`${item.href}-${i}`}
                  >
                    {i > 0 && (
                      <ChevronRight
                        aria-hidden
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    )}
                    {isLast ? (
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                    ) : (
                      <a
                        className={`
                          transition-colors
                          hover:text-foreground
                        `}
                        href={item.href}
                      >
                        {i === 0 ? <Home className="h-3.5 w-3.5" /> : item.name}
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-6">
            <h1
              className={`
                text-2xl font-bold tracking-tight
                md:text-3xl
              `}
            >
              {title}
            </h1>
            {(categoryDescriptionFull?.trim() || description) && (
              <p
                className={`
                  mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground
                `}
              >
                {categoryDescriptionFull?.trim() || description}
              </p>
            )}
          </header>

          {/* Sticky controls bar: sort + search + active filter count */}
          <div
            className={`
              sticky top-0 z-20 -mx-4 mb-4 border-b border-transparent
              bg-background/95 px-4 py-2 backdrop-blur-md
              sm:-mx-6 sm:px-6
              lg:-mx-8 lg:px-8
              [&:not(:first-child)]:border-border/50
            `}
          >
            <div
              className={`
                flex flex-col gap-3
                sm:flex-row sm:items-center sm:justify-between
              `}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  aria-hidden
                  className={`
                    hidden h-4 w-4 text-muted-foreground
                    sm:block
                  `}
                />
                <label className="sr-only" htmlFor="sort-products">
                  Sort by
                </label>
                <select
                  className={`
                    h-9 rounded-md border border-input bg-background px-3 py-1
                    text-sm
                    focus-visible:ring-2 focus-visible:ring-ring
                    focus-visible:outline-none
                  `}
                  id="sort-products"
                  onChange={(e) =>
                    handleSortChange(e.target.value as SortOption)
                  }
                  value={sort}
                >
                  {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
                {total > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {total} {total === 1 ? "product" : "products"}
                  </span>
                )}
                {activeFilterCount > 0 && (
                  <Button
                    className={`
                      gap-1 text-xs text-muted-foreground
                      hover:text-foreground
                    `}
                    onClick={() => {
                      setSearchInput("");
                      setSelectedSubcategory("");
                      setSort("newest");
                      if (selectedCategory !== "all") {
                        handleCategoryChange("all");
                      } else {
                        setPage(1);
                        fetchProducts(1, "all", "newest", "", "");
                        router.push("/products", { scroll: false });
                      }
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                    Clear filters ({activeFilterCount})
                  </Button>
                )}
              </div>
              <div
                className={`
                  relative w-full
                  sm:w-64
                `}
              >
                <Search
                  aria-hidden
                  className={`
                    absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2
                    text-muted-foreground
                  `}
                />
                <Input
                  aria-label="Search products in this category"
                  className="pl-9"
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search products…"
                  type="search"
                  value={searchInput}
                />
              </div>
            </div>
          </div>

          {/* Category pills */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <Button
                aria-pressed={cat.slug === selectedCategory}
                className="gap-1.5 rounded-full pr-3 pl-1.5"
                key={cat.slug}
                onClick={() => handleCategoryChange(cat.slug)}
                size="sm"
                title={`Filter by ${cat.name}`}
                variant={cat.slug === selectedCategory ? "default" : "outline"}
              >
                {cat.image?.trim() ? (
                  <span
                    className={`
                      relative size-6 shrink-0 overflow-hidden rounded-full
                      bg-white
                    `}
                  >
                    <Image
                      alt=""
                      className="object-contain"
                      fill
                      sizes="24px"
                      src={cat.image}
                      unoptimized={
                        cat.image.startsWith("data:") ||
                        cat.image.startsWith("http://")
                      }
                    />
                  </span>
                ) : null}
                {cat.name}
              </Button>
            ))}
          </div>

          {subcategories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                aria-pressed={selectedSubcategory === ""}
                className="rounded-full"
                onClick={() => handleSubcategoryChange("")}
                size="sm"
                variant={selectedSubcategory === "" ? "default" : "outline"}
              >
                All
              </Button>
              {subcategories.map((sub) => (
                <Button
                  aria-pressed={sub.slug === selectedSubcategory}
                  className="rounded-full"
                  key={sub.slug}
                  onClick={() => handleSubcategoryChange(sub.slug)}
                  size="sm"
                  variant={
                    sub.slug === selectedSubcategory ? "default" : "outline"
                  }
                >
                  {sub.name}
                </Button>
              ))}
            </div>
          )}

          {/* Products grid + pagination */}
          <section aria-label="Products in this category" className="flex flex-col gap-6">
            {loading ? (
              <ProductGridSkeleton count={limit} />
            ) : (
              <>
                <div
                  className={`
                    grid grid-cols-1 gap-6
                    sm:grid-cols-2
                    md:grid-cols-3
                    lg:grid-cols-4
                  `}
                  ref={productGridRef}
                >
                  {products.map((product, index) => (
                    <ProductCard
                      isInWishlist={isInWishlist(product.id)}
                      key={product.id}
                      onAddToCart={handleAddToCart}
                      onAddToWishlist={handleAddToWishlist}
                      onPreloadQuickView={() => setPreloadQuickView(true)}
                      onQuickView={handleQuickView}
                      onRemoveFromWishlist={handleRemoveFromWishlist}
                      priority={index < 4}
                      product={product}
                    />
                  ))}
                </div>

                {products.length === 0 && (
                  <div className="py-16 text-center">
                    <div
                      className={`
                        mx-auto mb-4 flex h-16 w-16 items-center justify-center
                        rounded-full bg-muted
                      `}
                    >
                      <Search className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No products found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {searchQuery
                        ? `No products match "${searchQuery}". Try a different search term.`
                        : "No products found in this category."}
                    </p>
                    {(searchQuery ||
                      selectedSubcategory ||
                      selectedCategory !== "all") && (
                      <Button
                        className="mt-4"
                        onClick={() => {
                          setSearchInput("");
                          setSelectedSubcategory("");
                          if (selectedCategory !== "all") {
                            handleCategoryChange("all");
                          } else {
                            setPage(1);
                            fetchProducts(1, selectedCategory, sort, "", "");
                            router.push(
                              buildPath({ page: 1, q: "", subcategory: "" }),
                              { scroll: false },
                            );
                          }
                        }}
                        variant="outline"
                      >
                        Clear all filters
                      </Button>
                    )}
                  </div>
                )}

                {/* Pagination: Previous + Load More */}
                {(page > 1 || page < totalPages) && products.length > 0 && (
                  <div className="mt-10 flex flex-col items-center gap-3">
                    <div
                      className={`
                        flex flex-wrap items-center justify-center gap-3
                      `}
                    >
                      {page > 1 && (
                        <Button
                          className="gap-2"
                          onClick={handlePreviousPage}
                          size="lg"
                          variant="outline"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                      )}
                      {page < totalPages && (
                        <Button
                          className="min-w-[200px] gap-2"
                          disabled={loadingMore}
                          onClick={handleLoadMore}
                          size="lg"
                          variant="outline"
                        >
                          {loadingMore ? (
                            <div
                              className={`
                                h-4 w-4 animate-spin rounded-full border-2
                                border-primary border-t-transparent
                              `}
                            />
                          ) : null}
                          {loadingMore ? "Loading…" : "Load More Products"}
                        </Button>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {page >= totalPages && total > limit
                        ? `Showing all ${total} products`
                        : `Showing ${products.length} of ${total} products`}
                    </span>
                  </div>
                )}

                {/* All loaded indicator (no pagination controls) */}
                {page >= totalPages &&
                  products.length > 0 &&
                  total > limit &&
                  products.length >= total && (
                    <p
                      className={`
                        mt-8 text-center text-sm text-muted-foreground
                      `}
                    >
                      Showing all {total} products
                    </p>
                  )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* Quick View drawer — lazy load when grid in view or card hovered */}
      {(quickViewOpen || preloadQuickView) && (
        <ProductQuickView
          onOpenChange={setQuickViewOpen}
          open={quickViewOpen}
          productSlugOrId={quickViewSlug}
        />
      )}
    </div>
  );
}
