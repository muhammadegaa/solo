// OpenRouter: one key for transcription, chat and speech.
// Endpoints from https://openrouter.ai/blog/announcements/announcing-audio-apis/
import { config } from "./config";

const BASE = "https://openrouter.ai/api/v1";

async function post(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.openrouterKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${path} failed (${res.status}): ${await res.text()}`);
  return res;
}

export async function transcribe(wavBase64: string): Promise<string> {
  const res = await post("/audio/transcriptions", {
    model: config.sttModel,
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
    model: config.chatModel,
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
  const voice = config.elevenlabsVoice();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: config.elevenlabsModel }),
  });
  if (!res.ok) throw new Error(`ElevenLabs failed (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function speak(text: string): Promise<Buffer> {
  if (config.elevenlabsKey) return speakElevenLabs(text, config.elevenlabsKey);
  const res = await post("/audio/speech", {
    model: config.ttsModel,
    input: text,
    voice: config.ttsVoice,
    response_format: "mp3",
  });
  return Buffer.from(await res.arrayBuffer());
}
