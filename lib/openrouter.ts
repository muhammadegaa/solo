// OpenRouter: one key for transcription, chat and speech.
// Endpoints from https://openrouter.ai/blog/announcements/announcing-audio-apis/
const BASE = "https://openrouter.ai/api/v1";

const key = () => {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("Missing OPENROUTER_API_KEY in .env.local");
  return k;
};

async function post(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${path} failed (${res.status}): ${await res.text()}`);
  return res;
}

export async function transcribe(wavBase64: string): Promise<string> {
  const res = await post("/audio/transcriptions", {
    model: process.env.OPENROUTER_STT_MODEL ?? "openai/gpt-4o-mini-transcribe",
    input_audio: { data: wavBase64, format: "wav" },
    language: "en",
  });
  const body = await res.json();
  if (typeof body.text !== "string") throw new Error(`Unexpected transcription response: ${JSON.stringify(body).slice(0, 300)}`);
  return body.text.trim();
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: Msg[]): Promise<string> {
  const res = await post("/chat/completions", {
    model: process.env.OPENROUTER_CHAT_MODEL ?? "anthropic/claude-sonnet-4.6",
    messages,
    max_tokens: 250,
  });
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error(`Unexpected chat response: ${JSON.stringify(body).slice(0, 300)}`);
  return text.trim();
}

// ElevenLabs v4 when its key is set (https://elevenlabs.io/docs/api-reference/text-to-speech/convert); otherwise OpenRouter.
async function speakElevenLabs(text: string, apiKey: string): Promise<Buffer> {
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!voice) throw new Error("Missing ELEVENLABS_VOICE_ID in .env.local");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL ?? "eleven_v4_turbo" }),
  });
  if (!res.ok) throw new Error(`ElevenLabs failed (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function speak(text: string): Promise<Buffer> {
  if (process.env.ELEVENLABS_API_KEY) return speakElevenLabs(text, process.env.ELEVENLABS_API_KEY);
  const res = await post("/audio/speech", {
    model: process.env.OPENROUTER_TTS_MODEL ?? "openai/gpt-4o-mini-tts-2025-12-15",
    input: text,
    voice: process.env.OPENROUTER_TTS_VOICE ?? "alloy",
    response_format: "mp3",
    instructions: "Speak slowly and warmly, like a calm friend early in the morning.",
  });
  return Buffer.from(await res.arrayBuffer());
}
