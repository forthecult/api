import { apiFetch } from './client';

export type TokenPriceResponse = { priceUsd?: number; [key: string]: unknown };
export type PoolStatsResponse = { totalStaked?: number; [key: string]: unknown };
export type Proposal = { id: string; title?: string; [key: string]: unknown };
export type ProposalsResponse = { proposals?: Proposal[]; [key: string]: unknown };

export async function getTokenPrice(): Promise<TokenPriceResponse> {
  return apiFetch<TokenPriceResponse>('/api/governance/token-price');
}

export async function getPoolStats(): Promise<PoolStatsResponse> {
  return apiFetch<PoolStatsResponse>('/api/governance/pool-stats');
}

export async function getProposals(): Promise<ProposalsResponse> {
  return apiFetch<ProposalsResponse>('/api/governance/proposals');
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  try {
    return await apiFetch<Proposal>(`/api/governance/proposals/${id}`);
  } catch {
    return null;
  }
}

export async function voteOnProposal(
  proposalId: string,
  body: { vote: 'for' | 'against' | 'abstain' }
): Promise<unknown> {
  return apiFetch(`/api/governance/proposals/${proposalId}/vote`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
