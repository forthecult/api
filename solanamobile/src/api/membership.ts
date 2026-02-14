import { apiFetch } from './client';

export type TierInfo = {
  tier?: number;
  name?: string;
  minStaked?: number;
  [key: string]: unknown;
};

export async function getMembershipTiers(): Promise<{ tiers?: TierInfo[] }> {
  try {
    return await apiFetch<{ tiers?: TierInfo[] }>('/api/governance/token-price');
  } catch {
    return { tiers: [] };
  }
}
