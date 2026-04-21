"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/** Raw order response from GET /api/checkout/orders/[orderId]. Used to avoid a second fetch in pay clients. */
export type PrefetchedOrder = Record<string, unknown> & {
  depositAddress?: string;
  email?: string;
  expiresAt?: string;
  orderId?: string;
  paymentType?: string;
  totalCents?: number;
};

interface OrderPrefetchState {
  order: null | PrefetchedOrder;
  orderError: null | string;
  orderLoading: boolean;
}

const OrderPrefetchContext = createContext<null | OrderPrefetchState>(null);

export function OrderPrefetchProvider({
  children,
  orderId,
}: {
  children: ReactNode;
  orderId: string;
}) {
  const [state, setState] = useState<OrderPrefetchState>({
    order: null,
    orderError: null,
    orderLoading: true,
  });
  const fetched = useRef(false);

  const fetchOrder = useCallback(() => {
    if (!orderId?.trim()) {
      setState({
        order: null,
        orderError: "Missing order",
        orderLoading: false,
      });
      return;
    }
    if (fetched.current) return;
    fetched.current = true;

    fetch(`/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Order not found");
          throw new Error("Failed to load order");
        }
        return res.json();
      })
      .then((raw: unknown) => {
        const data = raw as PrefetchedOrder;
        setState({ order: data, orderError: null, orderLoading: false });
      })
      .catch((err: unknown) => {
        setState({
          order: null,
          orderError:
            err instanceof Error ? err.message : "Failed to load order",
          orderLoading: false,
        });
      });
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return (
    <OrderPrefetchContext.Provider value={state}>
      {children}
    </OrderPrefetchContext.Provider>
  );
}

export function useOrderPrefetch(): null | OrderPrefetchState {
  return useContext(OrderPrefetchContext);
}
