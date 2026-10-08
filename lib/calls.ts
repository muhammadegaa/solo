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
  factors: string[]; // life context he mentioned, e.g. "no coffee", "worked outside home"
};

export const localDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(d);

const EXTRACT = `Read this check-in call between a coach (assistant) and a user. Return only JSON, no prose:
{"plan":[{"time":"HH:MM" or null,"action":"short plain action, under 8 words"}],"stress":1-5 or null,"summary":"one plain sentence, under 20 words, about how the user is and what was agreed","factors":["..."]}
"plan" is only what the user agreed to do today; use a time only if one was said, otherwise null. "stress" is the number the user gave for their stress, or null if they gave none.
"factors" are things the user said about today or last night that could affect sleep, energy or stress. Use these exact tags when they fit: "coffee", "no coffee", "late coffee", "alcohol", "worked outside home", "stayed home all day", "looking after kids", "job interview", "job rejection", "job applications", "exercise", "late screens", "nap", "felt fresh", "felt tired", "felt low", "busy day". Otherwise a short lowercase tag of 1-3 words. Only what he actually said. Empty list if none.`;

export async function extract(messages: Msg[]): Promise<Pick<CallRecord, "plan" | "stress" | "summary" | "factors">> {
  const transcript = messages.map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`).join("\n");
  try {
    const raw = await chat([{ role: "system", content: EXTRACT }, { role: "user", content: transcript }]);
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const stress = Number.isInteger(j.stress) && j.stress >= 1 && j.stress <= 5 ? j.stress : null;
    const plan = Array.isArray(j.plan) ? j.plan.filter((p: PlanItem) => typeof p?.action === "string").map((p: PlanItem) => ({ time: typeof p.time === "string" ? p.time : null, action: p.action })) : [];
    const factors = Array.isArray(j.factors) ? [...new Set(j.factors.filter((f: unknown) => typeof f === "string").map((f: string) => f.trim().toLowerCase()).filter(Boolean))] as string[] : [];
    return { plan, stress, summary: typeof j.summary === "string" ? j.summary : "", factors };
  } catch (e) {
    console.error("call extract", e);
    return { plan: [], stress: null, summary: "", factors: [] };
  }
}

export async function saveCall(uid: string, input: { startedAt: number; durationS: number; messages: Msg[]; turnsMs: CallRecord["turnsMs"]; stressTap?: number | null; findingIds?: string[] }) {
  const facts = input.messages.some((m) => m.role === "user") ? await extract(input.messages) : { plan: [], stress: null, summary: "", factors: [] };
  const tap = input.stressTap;
  if (Number.isInteger(tap) && tap! >= 1 && tap! <= 5) facts.stress = tap!; // the on-screen tap wins over anything said
  const startedAt = new Date(input.startedAt);
  if (input.findingIds?.length) await markShown(uid, input.findingIds, localDate(startedAt));
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

// users/{uid}/meta/insights: { shown: { findingId: "YYYY-MM-DD" } }, so calls don't repeat themselves.
export async function getShown(uid: string): Promise<Record<string, string>> {
  return (await db().doc(`users/${uid}/meta/insights`).get()).data()?.shown ?? {};
}

async function markShown(uid: string, ids: string[], date: string) {
  await db().doc(`users/${uid}/meta/insights`).set({ shown: Object.fromEntries(ids.map((id) => [id, date])) }, { merge: true });
}

export async function recentCalls(uid: string, days: number): Promise<CallRecord[]> {
  const since = Timestamp.fromMillis(Date.now() - days * 86_400_000);
  const snap = await db().collection(`users/${uid}/calls`).where("startedAt", ">=", since).orderBy("startedAt", "desc").limit(100).get();
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, factors: [], ...x, startedAt: (x.startedAt as Timestamp).toDate() } as unknown as CallRecord;
  });
}
