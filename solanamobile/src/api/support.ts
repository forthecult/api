import { apiFetch } from './client';

export type Conversation = {
  id: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type Message = {
  id: string;
  role?: 'user' | 'assistant';
  content?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export async function getConversations(params?: {
  page?: number;
  limit?: number;
}): Promise<{ conversations: Conversation[]; pagination?: { page: number; total: number; totalPages: number } }> {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return apiFetch(`/api/support-chat/conversations${qs ? `?${qs}` : ''}`);
}

export async function createConversation(): Promise<Conversation> {
  return apiFetch<Conversation>('/api/support-chat/conversations', {
    method: 'POST',
  });
}

export async function getMessages(conversationId: string): Promise<{ messages: Message[] }> {
  try {
    return await apiFetch<{ messages: Message[] }>(
      `/api/support-chat/conversations/${conversationId}/messages`
    );
  } catch {
    return { messages: [] };
  }
}

export async function sendMessage(
  conversationId: string,
  body: { content: string }
): Promise<{ message?: Message }> {
  return apiFetch(`/api/support-chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
