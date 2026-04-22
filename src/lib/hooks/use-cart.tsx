"use client";

import * as React from "react";

import type { CartItem } from "~/ui/components/cart";

import { trackAddToCart } from "~/lib/analytics/ecommerce";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export interface CartContextType {
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  /** Controlled open state for cart drawer/sheet (used by CartClient). */
  cartOpen: boolean;
  clearCart: () => void;
  isHydrated: boolean;
  itemCount: number;
  items: CartItem[];
  openCart: () => void;
  removeItem: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  subtotal: number;
  updateQuantity: (id: string, quantity: number) => void;
}

/* -------------------------------------------------------------------------- */
/*                                Context                                     */
/* -------------------------------------------------------------------------- */

const CartContext = React.createContext<CartContextType | undefined>(undefined);

/* -------------------------------------------------------------------------- */
/*                         Local-storage helpers                              */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "cart";
const DEBOUNCE_MS = 500;

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as CartItem[];
    }
  } catch (err) {
    console.error("Failed to load cart:", err);
  }
  return [];
};

/* -------------------------------------------------------------------------- */
/*                               Provider                                     */
/* -------------------------------------------------------------------------- */

export function CartProvider({ children }: React.PropsWithChildren) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);

  /* -------------------- Restore from localStorage on mount --------------- */
  React.useEffect(() => {
    setItems(loadCartFromStorage());
    setCartHydrated(true);
  }, []);

  /* -------------------- Persist to localStorage (debounced) ------------- */
  const saveTimeout = React.useRef<null | ReturnType<typeof setTimeout>>(null);

  React.useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.error("Failed to save cart:", err);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [items]);

  /* ----------------------------- Actions -------------------------------- */
  const addItem = React.useCallback(
    (newItem: Omit<CartItem, "quantity">, qty = 1) => {
      if (qty <= 0) return;
      setItems((prev) => {
        const existing = prev.find((i) => i.id === newItem.id);
        const wasEmpty = prev.length === 0;
        let next: CartItem[];
        if (existing) {
          next = prev.map((i) =>
            i.id === newItem.id ? { ...i, quantity: i.quantity + qty } : i,
          );
        } else {
          next = [...prev, { ...newItem, quantity: qty }];
        }
        if (wasEmpty && next.length > 0) {
          React.startTransition(() => setCartOpen(true));
        }
        queueMicrotask(() => {
          trackAddToCart({
            price: newItem.price,
            productId: newItem.productId ?? newItem.id,
            productName: newItem.name,
            quantity: qty,
            variantId: newItem.productVariantId,
          });
        });
        return next;
      });
    },
    [],
  );

  const openCart = React.useCallback(() => setCartOpen(true), []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = React.useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.id !== id) return i;
        if (qty <= 0) return []; // treat zero/negative as remove
        if (qty === i.quantity) return i;
        return { ...i, quantity: qty };
      }),
    );
  }, []);

  const clearCart = React.useCallback(() => setItems([]), []);

  /* --------------------------- Derived data ----------------------------- */
  const itemCount = React.useMemo(
    () => items.reduce((t, i) => t + i.quantity, 0),
    [items],
  );

  const subtotal = React.useMemo(
    () => items.reduce((t, i) => t + i.price * i.quantity, 0),
    [items],
  );

  /* ----------------------------- Context value -------------------------- */
  const value = React.useMemo<CartContextType>(
    () => ({
      addItem,
      cartOpen,
      clearCart,
      isHydrated: cartHydrated,
      itemCount,
      items,
      openCart,
      removeItem,
      setCartOpen,
      subtotal,
      updateQuantity,
    }),
    [
      items,
      cartHydrated,
      cartOpen,
      addItem,
      openCart,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      subtotal,
    ],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

/* -------------------------------------------------------------------------- */
/*                                 Hook                                      */
/* -------------------------------------------------------------------------- */

/** SSR-safe fallback: returned when CartProvider is not yet in the tree (e.g. during SSR). */
const SSR_FALLBACK: CartContextType = {
  addItem: () => {},
  cartOpen: false,
  clearCart: () => {},
  isHydrated: false,
  itemCount: 0,
  items: [],
  openCart: () => {},
  removeItem: () => {},
  setCartOpen: () => {},
  subtotal: 0,
  updateQuantity: () => {},
};

export function useCart(): CartContextType {
  const ctx = React.use(CartContext);
  if (!ctx) {
    // Return a safe no-op fallback instead of crashing. This handles:
    // 1. SSR when the provider tree hasn't mounted yet
    // 2. Client when a provider above CartProvider throws (e.g. wallet extension crash)
    if (typeof window !== "undefined") {
      console.warn("useCart: CartProvider not found, using fallback");
    }
    return SSR_FALLBACK;
  }
  return ctx;
}
