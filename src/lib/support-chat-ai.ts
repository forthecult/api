/**
 * Support chat AI reply. Routes through OpenClaw Gateway when configured,
 * falls back to direct OpenAI-compatible API, or returns a safe fallback.
 *
 * OpenClaw mode (recommended):
 *   Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN.
 *   Alice agent handles all replies with persistent memory and tool use.
 *
 * Direct mode (legacy):
 *   Set SUPPORT_CHAT_AI_API_KEY (and optionally SUPPORT_CHAT_AI_API_URL).
 *
 * No PII logged; content is sanitized (length limit).
 */

const MAX_CONTEXT_CHARS = 8_000;
const MAX_REPLY_CHARS = 1_500;

const FALLBACK_REPLY =
  "Thanks for reaching out. A team member will assist you shortly. You can also email us or create a support ticket from your dashboard for detailed requests.";

export interface SupportChatContext {
  recentMessages: { role: string; content: string }[];
  storeName?: string;
  /** Unique conversation/session ID. OpenClaw uses this for session continuity. */
  conversationId?: string;
  /** Guest ID or user ID. OpenClaw derives a stable session key from this. */
  userId?: string;
}

/**
 * Check if OpenClaw Gateway is configured.
 */
function isOpenClawConfigured(): boolean {
  return !!(
    process.env.OPENCLAW_GATEWAY_URL?.trim() &&
    process.env.OPENCLAW_GATEWAY_TOKEN?.trim()
  );
}

/**
 * Generate an AI reply via OpenClaw Gateway (Alice agent).
 * Returns null on failure so the caller can fall back.
 */
async function generateViaOpenClaw(
  context: SupportChatContext,
): Promise<string | null> {
  let gatewayUrl = process.env.OPENCLAW_GATEWAY_URL!.trim().replace(/\/$/, "");
  // Auto-prepend https:// if the protocol is missing
  if (!/^https?:\/\//i.test(gatewayUrl)) {
    gatewayUrl = `https://${gatewayUrl}`;
  }
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN!.trim();
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";

  const truncated = context.recentMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(-MAX_CONTEXT_CHARS);

  try {
    const body: Record<string, unknown> = {
      model: `openclaw:${agentId}`,
      messages: [
        { role: "user", content: truncated || "Hello" },
      ],
      max_tokens: 500,
      // OpenClaw uses the `user` field to derive a stable session key,
      // so the same customer gets session continuity across messages.
      ...(context.userId ? { user: context.userId } : {}),
    };

    const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
        "x-openclaw-agent-id": agentId,
        // Pass conversation ID so OpenClaw can group messages
        ...(context.conversationId
          ? { "x-openclaw-session-key": context.conversationId }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "(unreadable)");
      console.error(
        `[SupportChat] OpenClaw reply failed: ${res.status} ${res.statusText}`,
        `| URL: ${gatewayUrl}/v1/chat/completions`,
        `| Body: ${errorBody.slice(0, 500)}`,
      );
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content?.trim().slice(0, MAX_REPLY_CHARS) ??
      "";
    if (!content) {
      console.warn(
        "[SupportChat] OpenClaw returned OK but empty content. Response:",
        JSON.stringify(data).slice(0, 500),
      );
    }
    return content || null;
  } catch (err) {
    console.error("[SupportChat] OpenClaw network/parse error:", err);
    return null;
  }
}

/**
 * Generate an AI reply via direct OpenAI-compatible API (legacy path).
 * Returns null on failure.
 */
async function generateViaDirect(
  context: SupportChatContext,
): Promise<string | null> {
  const apiKey = process.env.SUPPORT_CHAT_AI_API_KEY?.trim();
  const apiUrl =
    process.env.SUPPORT_CHAT_AI_API_URL?.trim() ||
    "https://api.openai.com/v1/chat/completions";

  if (!apiKey) return null;

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

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content =
      data.choices?.[0]?.message?.content?.trim().slice(0, MAX_REPLY_CHARS) ??
      "";
    return content || null;
  } catch {
    return null;
  }
}

/**
 * Generate an AI reply for support chat.
 *
 * Priority: OpenClaw Gateway → direct API → fallback message.
 * Never throws; returns fallback on any error.
 */
export async function generateSupportChatReply(
  context: SupportChatContext,
): Promise<string> {
  // 1. Try OpenClaw Gateway (Alice with memory, tools, multi-channel)
  if (isOpenClawConfigured()) {
    console.log("[SupportChat] OpenClaw is configured, attempting AI reply…");
    const reply = await generateViaOpenClaw(context);
    if (reply) return reply;
    console.warn("[SupportChat] OpenClaw returned no reply, falling through…");
    // Fall through to direct API if OpenClaw fails
  } else {
    console.warn(
      "[SupportChat] OpenClaw NOT configured. OPENCLAW_GATEWAY_URL:",
      process.env.OPENCLAW_GATEWAY_URL ? "set" : "MISSING",
      "| OPENCLAW_GATEWAY_TOKEN:",
      process.env.OPENCLAW_GATEWAY_TOKEN ? "set" : "MISSING",
    );
  }

  // 2. Try direct OpenAI-compatible API (legacy)
  const directReply = await generateViaDirect(context);
  if (directReply) return directReply;

  // 3. Safe fallback
  console.warn("[SupportChat] All AI providers failed — returning fallback reply.");
  return FALLBACK_REPLY;
}
