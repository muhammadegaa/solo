import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { config } from "./config";
import { db } from "./firebase-admin";
import { chat, type Msg } from "./openrouter";

// users/{uid}/calls/{id}
export type PlanItem = { time: string | null; action: string };
export type CallRecord = {
  id: string;
  startedAt: Date;
  localDate: string; // YYYY-MM-DD in config.timeZone
  durationS: number;
  messages: Msg[];
  turnsMs: { stt: number; llm: number; tts: number }[];
  plan: PlanItem[];
  stress: number | null;
  summary: string;
};

export const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(d);

const EXTRACT = `Read this check-in call between a coach (assistant) and a user. Return only JSON, no prose:
{"plan":[{"time":"HH:MM" or null,"action":"short plain action, under 8 words"}],"stress":1-5 or null,"summary":"one plain sentence, under 20 words, about how the user is and what was agreed"}
"plan" is only what the user agreed to do today; use a time only if one was said, otherwise null. "stress" is the number the user gave for their stress, or null if they gave none.`;

async function extract(messages: Msg[]): Promise<Pick<CallRecord, "plan" | "stress" | "summary">> {
  const transcript = messages.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n");
  try {
    const raw = await chat([{ role: "system", content: EXTRACT }, { role: "user", content: transcript }]);
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const stress = Number.isInteger(j.stress) && j.stress >= 1 && j.stress <= 5 ? j.stress : null;
    const plan = Array.isArray(j.plan) ? j.plan.filter((p: PlanItem) => typeof p?.action === "string").map((p: PlanItem) => ({ time: typeof p.time === "string" ? p.time : null, action: p.action })) : [];
    return { plan, stress, summary: typeof j.summary === "string" ? j.summary : "" };
  } catch (e) {
    console.error("call extract", e);
    return { plan: [], stress: null, summary: "" };
  }
}

export async function saveCall(uid: string, input: { startedAt: number; durationS: number; messages: Msg[]; turnsMs: CallRecord["turnsMs"] }) {
  const facts = input.messages.some((m) => m.role === "user") ? await extract(input.messages) : { plan: [], stress: null, summary: "" };
  const startedAt = new Date(input.startedAt);
  await db().collection(`users/${uid}/calls`).add({
    ...facts,
    startedAt: Timestamp.fromDate(startedAt),
    localDate: localDate(startedAt),
    durationS: input.durationS,
    messages: input.messages,
    turnsMs: input.turnsMs,
    createdAt: FieldValue.serverTimestamp(),
  });
  return facts;
}

export async function recentCalls(uid: string, days: number): Promise<CallRecord[]> {
  const since = Timestamp.fromMillis(Date.now() - days * 86_400_000);
  const snap = await db().collection(`users/${uid}/calls`).where("startedAt", ">=", since).orderBy("startedAt", "desc").limit(100).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, ...x, startedAt: (x.startedAt as Timestamp).toDate() } as CallRecord;
  });
}
