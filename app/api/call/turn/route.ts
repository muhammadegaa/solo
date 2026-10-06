import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { systemPrompt } from "@/lib/context";
import { chat, speak, transcribe, type Msg } from "@/lib/openrouter";

export const maxDuration = 60;

// One turn: optional user audio in, AI reply text + speech out. Timings are returned to measure latency (M1).
export async function POST(req: NextRequest) {
  if (!(await getUser())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { audio, history, summary } = (await req.json()) as { audio?: string; history: Msg[]; summary: string };

  try {
    const t0 = Date.now();
    const userText = audio ? await transcribe(audio) : null;
    const t1 = Date.now();
    const messages: Msg[] = [
      { role: "system", content: systemPrompt(summary) },
      ...history,
      { role: "user", content: userText || (history.length ? "(silence)" : "(call started)") },
    ];
    const reply = await chat(messages);
    const t2 = Date.now();
    const mp3 = await speak(reply);
    const t3 = Date.now();
    return NextResponse.json({ userText, reply, audio: mp3.toString("base64"), ms: { stt: t1 - t0, llm: t2 - t1, tts: t3 - t2 } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
