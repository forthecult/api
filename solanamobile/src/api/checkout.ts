import { apiFetch } from './client';

export type CreateOrderResponse = {
  invoiceId?: string;
  orderId?: string;
  [key: string]: unknown;
};

export type OrderStatusResponse = {
  status?: string;
  [key: string]: unknown;
};

export async function createSolanaPayOrder(body: {
  items: { productId: string; quantity: number; variantId?: string }[];
  walletAddress?: string;
  [key: string]: unknown;
}): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>('/api/checkout/solana-pay/create-order', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  return apiFetch<OrderStatusResponse>(`/api/orders/${orderId}/status`);
}
