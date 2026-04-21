import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";

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
import { auth } from "~/lib/auth";

export const maxDuration = 120;

/** Images in `messages` use the vision-capable model; text-only uses the default chat model. */

interface ChatBody {
  characterSlug?: string;
  guestId?: string;
  messages: UIMessage[];
  /** Optional project-scoped instructions (from client projects UI). */
  projectInstructions?: null | string;
  /** Optional project knowledge (serialized text + links from client). */
  projectKnowledgeContext?: null | string;
  /** Optional sampling; forwarded to the model when set. */
  temperature?: number;
  topP?: number;
  /** UI toggles: append capability hints to system (actual tools depend on provider). */
  urlScrapingEnabled?: boolean;
  webSearchEnabled?: boolean;
}

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
      { error: "AI service is not configured" },
      { status: 503 },
    );
  }

  let system = await buildAgentSystemPrompt({
    lastUserText: lastUser,
    userId,
    userPrompt,
    userRagEnabled,
    veniceApiKey,
  });

  const pi = body.projectInstructions?.trim();
  if (pi) {
    system += `\n\n[Project instructions]\n${pi}`;
  }

  const pk = body.projectKnowledgeContext?.trim();
  if (pk) {
    system += `\n\n[Project knowledge]\n${pk}`;
  }

  if (body.webSearchEnabled) {
    system += `\n\n[Session capabilities]\nThe user enabled web search in the UI. If the model or tools support live web lookup, use it when helpful; otherwise answer from training knowledge and say so.`;
  }
  if (body.urlScrapingEnabled) {
    system += `\n\n[Session capabilities]\nThe user enabled URL scraping in the UI. If the user shares a URL and the stack supports fetching, summarize or extract from it; otherwise give guidance without inventing page content.`;
  }

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

  const tRaw = body.temperature;
  const pRaw = body.topP;
  const temperature =
    typeof tRaw === "number" && Number.isFinite(tRaw) && tRaw >= 0 && tRaw <= 2
      ? tRaw
      : undefined;
  const topP =
    typeof pRaw === "number" && Number.isFinite(pRaw) && pRaw > 0 && pRaw <= 1
      ? pRaw
      : undefined;

  const sampling = normalizeVeniceSampling(temperature, topP);

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model,
    onFinish: async () => {
      if (!member) {
        await incrementGuestUsage(characterSlug, identifier);
      }
    },
    system,
    ...(sampling.temperature !== undefined
      ? { temperature: sampling.temperature }
      : {}),
    ...(sampling.topP !== undefined ? { topP: sampling.topP } : {}),
  });

  return result.toUIMessageStreamResponse();
}
