import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";

import { auth } from "~/lib/auth";
import {
  checkGuestQuota,
  incrementGuestUsage,
  isMember,
  resolveGuestIdentifier,
} from "~/lib/ai/access-control";
import { extractLastUserText } from "~/lib/ai/extract-user-text";
import { buildAgentSystemPrompt } from "~/lib/ai/prompt-assembler";
import { getOrCreateAiAgent } from "~/lib/ai/user-agent";
import {
  buildVeniceModelId,
  createVeniceProvider,
  defaultChatModelId,
  getServerVeniceApiKey,
} from "~/lib/ai/venice";

export const maxDuration = 120;

type ChatBody = {
  characterSlug?: string;
  guestId?: string;
  messages: UIMessage[];
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const lastUser = extractLastUserText(messages);

  let userPrompt: null | string = null;
  let userRagEnabled = true;
  let veniceApiKey = getServerVeniceApiKey();
  let agentCharacter: null | string = null;

  if (userId) {
    const agent = await getOrCreateAiAgent(userId);
    userPrompt = agent.userPrompt;
    userRagEnabled = agent.userRagEnabled;
    if (agent.veniceApiKey?.trim()) veniceApiKey = agent.veniceApiKey.trim();
    agentCharacter = agent.characterSlug?.trim() ?? null;
  }

  const characterSlug =
    agentCharacter ??
    body.characterSlug?.trim() ??
    process.env.VENICE_DEFAULT_CHARACTER?.trim() ??
    "default";

  const member = await isMember(userId);
  const guestHeader = request.headers.get("x-ai-guest-id")?.trim();
  const identifier = resolveGuestIdentifier({
    guestId: guestHeader ?? body.guestId ?? null,
    userId,
  });

  if (!member) {
    const q = await checkGuestQuota(characterSlug, identifier);
    if (!q.allowed) {
      return NextResponse.json(
        { error: "free_limit_reached", max: q.max, used: q.used },
        { status: 403 },
      );
    }
  }

  if (!veniceApiKey) {
    return NextResponse.json(
      { error: "Venice API is not configured" },
      { status: 503 },
    );
  }

  const system = await buildAgentSystemPrompt({
    lastUserText: lastUser,
    userId,
    userPrompt,
    userRagEnabled,
    veniceApiKey,
  });

  const baseModel = defaultChatModelId();
  const slugForModel = characterSlug === "default" ? null : characterSlug;
  const modelId = buildVeniceModelId(baseModel, {
    characterSlug: slugForModel,
  });
  const venice = createVeniceProvider(veniceApiKey);
  const model = venice(modelId);

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model,
    onFinish: async () => {
      if (!member) {
        await incrementGuestUsage(characterSlug, identifier);
      }
    },
    system,
  });

  return result.toUIMessageStreamResponse();
}
