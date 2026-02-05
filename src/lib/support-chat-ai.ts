/**
 * Support chat AI reply. Lightweight and secure:
 * - Optional: call external AI (e.g. OpenAI) when SUPPORT_CHAT_AI_API_KEY is set.
 * - Otherwise: return a safe fallback so the widget works without keys.
 * - No PII logged; content is sanitized (length limit).
 */

const MAX_CONTEXT_CHARS = 8_000;
const MAX_REPLY_CHARS = 1_500;

const FALLBACK_REPLY =
  "Thanks for reaching out. A team member will assist you shortly. You can also email us or create a support ticket from your dashboard for detailed requests.";

export interface SupportChatContext {
  recentMessages: { role: string; content: string }[];
  storeName?: string;
}

/**
 * Generate an AI reply for support chat. Uses external AI if configured, else fallback.
 * Never throws; returns fallback on any error.
 */
export async function generateSupportChatReply(
  context: SupportChatContext,
): Promise<string> {
  const apiKey = process.env.SUPPORT_CHAT_AI_API_KEY?.trim();
  const apiUrl =
    process.env.SUPPORT_CHAT_AI_API_URL?.trim() ||
    "https://api.openai.com/v1/chat/completions";

  if (!apiKey) {
    return FALLBACK_REPLY;
  }

  const truncated = context.recentMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(-MAX_CONTEXT_CHARS);

  const systemPrompt = `You are a helpful customer support agent for ${context.storeName ?? "our store"}. Be concise, friendly, and professional. Do not make up order numbers or personal data. If you cannot help, suggest the customer contact support or check their account.`;

  try {
    const body: Record<string, unknown> = {
      model: process.env.SUPPORT_CHAT_AI_MODEL?.trim() || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: truncated || "Hello" },
      ],
      max_tokens: 300,
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return FALLBACK_REPLY;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content?.trim().slice(0, MAX_REPLY_CHARS) ??
      "";
    return content || FALLBACK_REPLY;
  } catch {
    return FALLBACK_REPLY;
  }
}
