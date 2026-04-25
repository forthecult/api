import { NextResponse } from "next/server";

import { getOrCreateAiAgent } from "~/lib/ai/user-agent";
import { getServerVeniceApiKey } from "~/lib/ai/venice";
import { auth } from "~/lib/auth";

export const maxDuration = 60;

const VENICE_SPEECH = "https://api.venice.ai/api/v1/audio/speech";

const TTS_MODELS = new Set([
  "tts-chatterbox-hd",
  "tts-elevenlabs-turbo-v2-5",
  "tts-gemini-3-1-flash",
  "tts-inworld-1-5-max",
  "tts-kokoro",
  "tts-minimax-speech-02-hd",
  "tts-orpheus",
  "tts-qwen3-0-6b",
  "tts-qwen3-1-7b",
  "tts-xai-v1",
]);

const FORMATS = new Set(["aac", "flac", "mp3", "opus", "pcm", "wav"]);

interface TtsBody {
  input: string;
  model?: string;
  response_format?: string;
  streaming?: boolean;
  voice?: string;
}

/**
 * Proxies Venice `POST /v1/audio/speech` with the member’s or server Venice key.
 * Requires a signed-in user (TTS bills Venice credits; avoids guest abuse).
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  }

  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input =
    typeof body.input === "string" ? body.input.trim().slice(0, 4096) : "";
  if (!input) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  let veniceApiKey = getServerVeniceApiKey();
  if (!veniceApiKey) {
    return NextResponse.json(
      { error: "AI service is not configured" },
      { status: 503 },
    );
  }

  const agent = await getOrCreateAiAgent(userId);
  if (agent.veniceApiKey?.trim()) veniceApiKey = agent.veniceApiKey.trim();

  const defaultModel = process.env.VENICE_TTS_MODEL?.trim() || "tts-kokoro";
  const model =
    typeof body.model === "string" && TTS_MODELS.has(body.model)
      ? body.model
      : defaultModel;

  const defaultVoice = process.env.VENICE_TTS_VOICE?.trim() || "af_sky";
  const voice =
    typeof body.voice === "string" && /^[a-z0-9_]{2,64}$/i.test(body.voice)
      ? body.voice
      : defaultVoice;

  const response_format =
    typeof body.response_format === "string" &&
    FORMATS.has(body.response_format)
      ? body.response_format
      : "mp3";

  const payload = {
    input,
    model,
    response_format,
    streaming: Boolean(body.streaming),
    voice,
  };

  const res = await fetch(VENICE_SPEECH, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${veniceApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "tts_failed" },
      { status: res.status >= 500 ? 502 : 400 },
    );
  }

  const buf = await res.arrayBuffer();
  const ct =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  return new NextResponse(buf, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": ct,
    },
    status: 200,
  });
}
