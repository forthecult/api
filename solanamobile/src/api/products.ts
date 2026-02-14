import { apiFetch } from './client';

export type Product = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  price?: number;
  images?: { url: string; alt?: string }[];
  [key: string]: unknown;
};

export type ProductsResponse = {
  products: Product[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export async function getProducts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  q?: string;
}): Promise<ProductsResponse> {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.category) sp.set('category', params.category);
  if (params?.q) sp.set('q', params.q);
  const qs = sp.toString();
  return apiFetch<ProductsResponse>(`/api/products${qs ? `?${qs}` : ''}`);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await apiFetch<Product>(`/api/products/${slug}`);
  } catch {
    return null;
  }
}
