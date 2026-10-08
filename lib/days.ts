import { recentCalls } from "./calls";
import { config } from "./config";
import { dayShape, type DayShape } from "./dayshape";
import { db } from "./firebase-admin";
import { fetchDaySteps, fetchRaw, toRows } from "./polar";
import { lastDates } from "./week";

// One row per local date: body data from Polar, words from calls. The night belongs to the date you woke up.
export type Day = {
  date: string;
  bed: string | null;
  wake: string | null;
  sleepH: number | null;
  sleepScore: number | null;
  hrv: number | null;
  ans: number | null;
  steps: number | null;
  shape: DayShape | null;
  stress: number | null;
  factors: string[];
  said: string[]; // the user's own sentences from that day's calls
  calls: { time: string; summary: string }[];
};

// Per-minute features for past days never change once synced, so they are cached in Firestore.
async function shapes(uid: string, token: string, dates: string[], today: string): Promise<Map<string, DayShape>> {
  const col = db().collection(`users/${uid}/dayShapes`);
  const snaps = await db().getAll(...dates.map((d) => col.doc(d)));
  const cached = new Map(snaps.filter((d) => d.exists).map((d) => [d.id, d.data() as DayShape & { complete: boolean }]));
  const out = new Map<string, DayShape>();
  await Promise.all(
    dates.map(async (date) => {
      const c = cached.get(date);
      if (c?.complete) return out.set(date, c);
      const steps = await fetchDaySteps(token, date).catch(() => null);
      if (!steps) return;
      const s = dayShape(steps.samples);
      out.set(date, s);
      await col.doc(date).set({ ...s, complete: date < today && (s.syncedTo ?? 0) >= 23 * 60 });
    }),
  );
  return out;
}

export async function getDays(uid: string, token: string | null): Promise<Day[]> {
  const dates = lastDates(config.findingDays, config.timeZone);
  const today = dates[dates.length - 1];
  const [calls, rows, shapeMap] = await Promise.all([
    recentCalls(uid, config.findingDays + 1),
    token ? fetchRaw(token, 28).then((r) => toRows(r, 28)).catch(() => []) : Promise.resolve([]),
    token ? shapes(uid, token, dates.slice(-config.shapeDays), today) : Promise.resolve(new Map<string, DayShape>()),
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return dates.map((date) => {
    const r = byDate.get(date);
    const dc = calls.filter((c) => c.localDate === date);
    const ratings = dc.map((c) => c.stress).filter((x): x is number => x !== null);
    return {
      date,
      bed: r?.bed ?? null,
      wake: r?.wake ?? null,
      sleepH: r?.sleepH ?? null,
      sleepScore: r?.sleepScore ?? null,
      hrv: r?.hrv ?? null,
      ans: r?.ansCharge ?? null,
      steps: r?.steps ?? null,
      shape: shapeMap.get(date) ?? null,
      stress: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      factors: [...new Set(dc.flatMap((c) => c.factors ?? []))],
      said: dc.flatMap((c) => c.messages.filter((m) => m.role === "user").map((m) => m.content)),
      calls: dc.map((c) => ({ time: c.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: config.timeZone }), summary: c.summary })).reverse(),
    };
  });
}
