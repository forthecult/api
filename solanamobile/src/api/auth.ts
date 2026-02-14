import { apiFetch, getSessionHeader, setSessionHeader } from './client';
import { API_BASE_URL } from '../constants/config';

const AUTH_PREFIX = '/api/auth';

export type SolanaChallengeResponse = { message: string };
export type SolanaVerifyResponse = { session?: unknown; user?: unknown };

/**
 * 1. Get challenge message for the wallet address.
 */
export async function signInSolanaChallenge(address: string): Promise<SolanaChallengeResponse> {
  return apiFetch<SolanaChallengeResponse>(`${AUTH_PREFIX}/sign-in/solana/challenge`, {
    method: 'POST',
    body: JSON.stringify({ address }),
    skipAuth: true,
  });
}

/**
 * 2. Verify signature and create session. Backend sets cookie; we need to pass
 * the response to captureCookiesFromResponse in the caller (native fetch to read headers).
 */
export async function signInSolanaVerify(params: {
  address: string;
  message: string;
  signature?: string;
  signatureBase58?: string;
  link?: boolean;
}): Promise<SolanaVerifyResponse> {
  const url = `${API_BASE_URL}${AUTH_PREFIX}/sign-in/solana/verify`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  let data: SolanaVerifyResponse;
  try {
    data = (text ? JSON.parse(text) : {}) as SolanaVerifyResponse;
  } catch {
    data = {} as SolanaVerifyResponse;
  }
  if (!res.ok) {
    throw new Error(data && typeof (data as { error?: { message?: string } }).error?.message === 'string'
      ? (data as { error: { message: string } }).error.message
      : `Sign-in failed: ${res.status}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    await setSessionHeader(setCookie);
  }
  return data;
}

/**
 * Get current session (better-auth getSession). Used to check if still logged in.
 */
export async function getSession(): Promise<{ session?: unknown; user?: unknown } | null> {
  try {
    const session = await getSessionHeader();
    if (!session) return null;
    const url = `${API_BASE_URL}/api/auth/get-session`;
    const res = await fetch(url, {
      headers: { Cookie: session },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? data ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch('/api/auth/sign-out', { method: 'POST' });
  } finally {
    await setSessionHeader(null);
  }
}
