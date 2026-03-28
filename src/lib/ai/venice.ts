import { createOpenAI } from "@ai-sdk/openai";

const VENICE_BASE_URL = "https://api.venice.ai/api/v1";

/** Venice model feature suffixes (character, system prompt control). */
export function buildVeniceModelId(
  baseModel: string,
  options: { characterSlug?: null | string },
): string {
  const parts = [baseModel.trim()];
  if (options.characterSlug?.trim()) {
    parts.push(`character_slug=${options.characterSlug.trim()}`);
  }
  parts.push("include_venice_system_prompt=false");
  return parts.join(":");
}

export function createVeniceProvider(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: VENICE_BASE_URL,
  });
}

export function defaultChatModelId(): string {
  return process.env.VENICE_DEFAULT_MODEL?.trim() || "llama-3.3-70b";
}

export function defaultVisionChatModelId(): string {
  return process.env.VENICE_VISION_MODEL?.trim() || "llama-3.2-90b-vision";
}


export function getServerVeniceApiKey(): string | undefined {
  return process.env.VENICE_API_KEY?.trim() || undefined;
}
