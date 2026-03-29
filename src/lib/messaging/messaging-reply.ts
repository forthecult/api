import { createId } from "@paralleldrive/cuid2";
import { convertToModelMessages, generateText, type UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import { db } from "~/db";
import { aiChatConversationTable } from "~/db/schema/ai-chat/tables";
import {
  checkGuestQuota,
  incrementGuestUsage,
  isMember,
  resolveGuestIdentifier,
} from "~/lib/ai/access-control";
import { extractLastUserText } from "~/lib/ai/extract-user-text";
import { messagesHaveUserImage } from "~/lib/ai/messages-utils";
import { buildAgentSystemPrompt } from "~/lib/ai/prompt-assembler";
import { getOrCreateAiAgent } from "~/lib/ai/user-agent";
import {
  buildVeniceModelId,
  createVeniceProvider,
  defaultChatModelId,
  defaultVisionChatModelId,
  getServerVeniceApiKey,
} from "~/lib/ai/venice";
import { normalizeVeniceSampling } from "~/lib/ai/venice-sampling";

const MAX_STORED_MESSAGES = 80;

export async function generateMessagingAgentReply(options: {
  conversationId: string;
  userId: string;
  userText: string;
}): Promise<
  | { error: string; ok: false; status?: number }
  | { ok: true; text: string }
> {
  const userText = options.userText.trim();
  if (!userText) return { error: "empty", ok: false };

  const agent = await getOrCreateAiAgent(options.userId);
  let veniceApiKey = getServerVeniceApiKey();
  if (agent.veniceApiKey?.trim()) veniceApiKey = agent.veniceApiKey.trim();
  const agentCharacter = agent.characterSlug?.trim() ?? null;
  const characterSlug =
    agentCharacter ??
    process.env.VENICE_DEFAULT_CHARACTER?.trim() ??
    "default";

  const member = await isMember(options.userId);
  const identifier = resolveGuestIdentifier({
    guestId: null,
    userId: options.userId,
  });

  if (!member) {
    const q = await checkGuestQuota(characterSlug, identifier);
    if (!q.allowed) {
      return { error: "quota", ok: false, status: 403 };
    }
  }

  if (!veniceApiKey) {
    return { error: "no_ai", ok: false, status: 503 };
  }

  const convo = await db
    .select()
    .from(aiChatConversationTable)
    .where(
      and(
        eq(aiChatConversationTable.id, options.conversationId),
        eq(aiChatConversationTable.userId, options.userId),
      ),
    )
    .limit(1);

  let messages: UIMessage[] = [];
  const row = convo[0];
  if (row?.messages && Array.isArray(row.messages)) {
    messages = row.messages as UIMessage[];
  }

  const userMsg: UIMessage = {
    id: createId(),
    parts: [{ text: userText, type: "text" }],
    role: "user",
  };
  messages = [...messages, userMsg];

  const lastUser = extractLastUserText(messages);

  const system = await buildAgentSystemPrompt({
    lastUserText: lastUser,
    userId: options.userId,
    userPrompt: agent.userPrompt,
    userRagEnabled: agent.userRagEnabled,
    veniceApiKey,
  });

  const useVision = messagesHaveUserImage(messages);
  const baseModel = useVision
    ? defaultVisionChatModelId()
    : defaultChatModelId();
  const slugForModel = characterSlug === "default" ? null : characterSlug;
  const modelId = buildVeniceModelId(baseModel, {
    characterSlug: slugForModel,
  });
  const venice = createVeniceProvider(veniceApiKey);
  const model = venice(modelId);

  const sampling = normalizeVeniceSampling(undefined, undefined);

  const { text } = await generateText({
    messages: await convertToModelMessages(messages),
    model,
    system,
    ...(sampling.temperature !== undefined
      ? { temperature: sampling.temperature }
      : {}),
    ...(sampling.topP !== undefined ? { topP: sampling.topP } : {}),
  });

  const assistantMsg: UIMessage = {
    id: createId(),
    parts: [{ text: text ?? "", type: "text" }],
    role: "assistant",
  };
  const updated = [...messages, assistantMsg];

  const trimmed =
    updated.length > MAX_STORED_MESSAGES
      ? updated.slice(updated.length - MAX_STORED_MESSAGES)
      : updated;

  await db
    .insert(aiChatConversationTable)
    .values({
      characterSlug,
      id: options.conversationId,
      messages: trimmed as unknown[],
      title: "Messaging",
      updatedAt: new Date(),
      userId: options.userId,
    })
    .onConflictDoUpdate({
      set: {
        messages: trimmed as unknown[],
        updatedAt: new Date(),
      },
      target: aiChatConversationTable.id,
    });

  if (!member) {
    await incrementGuestUsage(characterSlug, identifier);
  }

  return { ok: true, text: text ?? "" };
}

export function messagingConversationId(
  channelId: string,
  threadKey: string,
): string {
  const h = createHash("sha256")
    .update(`${channelId}:${threadKey}`)
    .digest("hex")
    .slice(0, 24);
  return `m-${channelId}-${h}`;
}
