import { apiFetch } from './client';

export type EsimPackage = {
  id: string;
  name?: string;
  price?: string;
  data_quantity?: number;
  data_unit?: string;
  package_validity?: number;
  package_validity_unit?: string;
  [key: string]: unknown;
};

export type EsimPackagesResponse = { data?: EsimPackage[]; [key: string]: unknown };
export type EsimPackageDetailResponse = { status?: boolean; data?: EsimPackage };

export async function getEsimPackages(params?: { page?: number; package_type?: string }): Promise<EsimPackagesResponse> {
  try {
    const sp = new URLSearchParams();
    if (params?.page != null) sp.set('page', String(params.page));
    if (params?.package_type) sp.set('package_type', params.package_type);
    const qs = sp.toString();
    return await apiFetch<EsimPackagesResponse>(`/api/esim/packages${qs ? `?${qs}` : ''}`);
  } catch {
    return { data: [] };
  }
}

export async function getEsimPackageById(id: string): Promise<EsimPackage | null> {
  try {
    const res = await apiFetch<EsimPackageDetailResponse>(`/api/esim/packages/${id}`);
    return res?.status && res?.data ? res.data : null;
  } catch {
    return null;
  }
}

export async function createEsimCheckout(body: {
  packageId: string;
  [key: string]: unknown;
}): Promise<{ checkoutId?: string; url?: string; [key: string]: unknown }> {
  return apiFetch('/api/esim/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function claimMembershipEsim(): Promise<unknown> {
  return apiFetch('/api/esim/membership-claim', { method: 'POST' });
}
