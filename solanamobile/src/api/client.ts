import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

const SESSION_KEY = 'session_cookie';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Get stored session (cookie or token) for API requests.
 * Backend uses cookies; we store the Cookie header value after sign-in.
 */
export async function getSessionHeader(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionHeader(value: string | null): Promise<void> {
  if (value == null) {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } else {
    await SecureStore.setItemAsync(SESSION_KEY, value);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...rest } = options ?? {};
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  if (!skipAuth) {
    const session = await getSessionHeader();
    if (session) {
      headers['Cookie'] = session;
      // Some backends also accept Authorization Bearer if you add a token endpoint later
      // if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const res = await fetch(url, { ...rest, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status}`, text);
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

