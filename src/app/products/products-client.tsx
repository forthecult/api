"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { useCart } from "~/lib/hooks/use-cart";
import { useWishlist } from "~/lib/hooks/use-wishlist";
import { ProductCard } from "~/ui/components/product-card";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Spinner } from "~/ui/primitives/spinner";

interface Product {
  category: string;
  id: string;
  image: string;
  inStock: boolean;
  name: string;
  originalPrice?: number;
  price: number;
  rating: number;
  slug?: string;
  tokenGated?: boolean;
  tokenGatePassed?: boolean;
}

interface CategoryOption {
  slug: string;
  name: string;
  /** Display image: category image or product fallback (not persisted). */
  image?: string | null;
}

export type SortOption =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "rating";

interface ProductsClientProps {
  initialProducts: Product[];
  initialCategories: CategoryOption[];
  initialPage: number;
  initialTotalPages: number;
  initialTotal: number;
  initialCategory: string;
  /** For category pages: heading and subtext (default: "Products" / "Browse our latest...") */
  title?: string;
  description?: string;
  /** Full category description (customer-facing, can be long) */
  categoryDescriptionFull?: string;
  /** Child categories for subcategory filter (when on a category page) */
  subcategories?: CategoryOption[];
  initialSort?: SortOption;
  initialSubcategory?: string;
  /** Initial search query (for category pages) */
  initialSearch?: string;
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  price_asc: "Price (low to high)",
  price_desc: "Price (high to low)",
  best_selling: "Best Selling",
  rating: "Rating",
};

export function ProductsClient({
  initialProducts,
  initialCategories,
  initialPage,
  initialTotalPages,
  initialTotal,
  initialCategory,
  title = "Products",
  description = "Browse our latest products and find something you'll love.",
  categoryDescriptionFull,
  subcategories = [],
  initialSort = "newest",
  initialSubcategory,
  initialSearch = "",
}: ProductsClientProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

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

  const limit = 12;

  // Debounce search input into searchQuery
  React.useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const buildPath = React.useCallback(
    (opts: {
      page?: number;
      sort?: SortOption;
      subcategory?: string;
      category?: string;
      q?: string;
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
      search: string = "",
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(newPage),
          limit: String(limit),
          sort: sortOption,
        });
        if (categorySlug !== "all") params.set("category", categorySlug);
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

        setProducts(
          (data.items ?? []).map((p) => ({
            ...p,
            inStock: p.inStock ?? true,
            rating: p.rating ?? 0,
            tokenGatePassed: (p as { tokenGatePassed?: boolean }).tokenGatePassed ?? false,
          })),
        );
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load products",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // When search query changes (user typed), go to page 1 and refetch
  const prevSearchRef = React.useRef(initialSearch);
  React.useEffect(() => {
    if (prevSearchRef.current === searchQuery) return;
    prevSearchRef.current = searchQuery;
    setPage(1);
    router.push(buildPath({ page: 1, q: searchQuery }), { scroll: false });
    fetchProducts(1, selectedCategory, sort, selectedSubcategory, searchQuery);
  }, [searchQuery, buildPath, selectedCategory, sort, selectedSubcategory, fetchProducts, router]);

  const handleCategoryChange = React.useCallback(
    (categorySlug: string) => {
      setSelectedCategory(categorySlug);
      setSelectedSubcategory("");
      setPage(1);
      const path = categorySlug === "all" ? "/products" : `/${categorySlug}`;
      router.push(`${path}?page=1`, { scroll: false });
      fetchProducts(1, categorySlug, sort, "", searchQuery);
    },
    [router, fetchProducts, sort],
  );

  const handleSortChange = React.useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      setPage(1);
      router.push(buildPath({ page: 1, sort: newSort }), { scroll: false });
      fetchProducts(1, selectedCategory, newSort, selectedSubcategory, searchQuery);
    },
    [router, selectedCategory, selectedSubcategory, fetchProducts, buildPath],
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
    [router, selectedCategory, sort, fetchProducts, buildPath],
  );

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      setPage(newPage);
      router.push(buildPath({ page: newPage }), { scroll: false });
      fetchProducts(newPage, selectedCategory, sort, selectedSubcategory, searchQuery);
    },
    [router, selectedCategory, sort, selectedSubcategory, fetchProducts, buildPath],
  );

  const handleAddToCart = React.useCallback(
    (productId: string) => {
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
    },
    [addItem, products],
  );

  const handleAddToWishlist = React.useCallback(
    async (productId: string) => {
      const result = await addToWishlist(productId);
      if (result.ok) {
        toast.success("Added to wishlist");
      } else {
        if (result.error === "Unauthorized" || result.error?.toLowerCase().includes("sign in")) {
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

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Compact header: title + one short line of description (SEO/category intro) */}
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-0.5 line-clamp-2 max-w-xl text-sm text-muted-foreground">
              {categoryDescriptionFull?.trim()
                ? categoryDescriptionFull.slice(0, 160).trim() + (categoryDescriptionFull.length > 160 ? "…" : "")
                : description}
            </p>
          </header>

          <div className="mb-6 flex flex-wrap items-center gap-2">
              <label htmlFor="sort-products" className="sr-only">
                Sort by
              </label>
              <select
                id="sort-products"
                value={sort}
                onChange={(e) =>
                  handleSortChange(e.target.value as SortOption)
                }
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              {categories.map((cat) => (
                <Button
                  aria-pressed={cat.slug === selectedCategory}
                  className="rounded-full gap-1.5 pl-1.5 pr-3"
                  key={cat.slug}
                  onClick={() => handleCategoryChange(cat.slug)}
                  size="sm"
                  title={`Filter by ${cat.name}`}
                  variant={
                    cat.slug === selectedCategory ? "default" : "outline"
                  }
                >
                  {cat.image?.trim() ? (
                    <span className="relative size-6 shrink-0 overflow-hidden rounded-full">
                      <Image
                        alt=""
                        className="object-cover"
                        fill
                        sizes="24px"
                        src={cat.image}
                        unoptimized={/^https?:\/\//i.test(cat.image)}
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

          {/* Products section: search + grid + pagination */}
          <section className="space-y-6" aria-label="Products in this category">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Products</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  placeholder="Search products…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                  aria-label="Search products in this category"
                />
              </div>
            </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner variant="page" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    isInWishlist={isInWishlist(product.id)}
                    onAddToCart={handleAddToCart}
                    onAddToWishlist={handleAddToWishlist}
                    onRemoveFromWishlist={handleRemoveFromWishlist}
                    product={product}
                  />
                ))}
              </div>

              {products.length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "No products match your search. Try a different term."
                      : "No products found in this category."}
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <nav
                  aria-label="Pagination"
                  className="mt-10 flex flex-wrap items-center justify-center gap-3"
                >
                  <Button
                    disabled={page <= 1}
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                    {total > 0 && ` (${total} products)`}
                  </span>
                  <Button
                    disabled={page >= totalPages}
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, page + 1))
                    }
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
          </section>
        </div>
      </main>
    </div>
  );
}
