import { fetchRaw, toRows } from "./polar";

export type Night = { date: string; sleepH: number | null; bed: string | null };
export type CallContext = { nights: Night[]; usualH: number | null; summary: string };

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
};

// Without a Polar token the call runs in no-device mode.
export async function getCallContext(): Promise<CallContext> {
  if (!process.env.POLAR_ACCESS_TOKEN) return { nights: [], usualH: null, summary: "No wearable data. Ask how they slept." };
  try {
    const rows = toRows(await fetchRaw(14), 14);
    const usualH = median(rows.map((r) => r.sleepH).filter((x): x is number => x !== null));
    const nights = rows.slice(0, 7).reverse().map((r) => ({ date: r.date, sleepH: r.sleepH, bed: r.bed }));
    const last = rows[0];
    const lines = rows.slice(0, 7).map((r) => `${r.date}: sleep ${r.sleepH ?? "?"} h, bed ${r.bed ?? "?"}, HRV ${r.hrv ?? "?"} ms, steps ${r.steps ?? "?"}`);
    const summary = [
      `Usual sleep (14-day median): ${usualH ?? "unknown"} h.`,
      `Last night (${last.date}): ${last.sleepH ?? "no data"} h, bed ${last.bed ?? "?"}, wake ${last.wake ?? "?"}.`,
      "Last 7 days, newest first:",
      ...lines,
    ].join("\n");
    return { nights, usualH, summary };
  } catch (e) {
    return { nights: [], usualH: null, summary: `Wearable data unavailable (${(e as Error).message}). Ask how they slept.` };
  }
}

export const systemPrompt = (summary: string) => `You run a short morning check-in call, by voice, with a dad who is at home most of the day, looking for work, and stressed. The goal is that he feels a bit better in body and mind today, with no pressure.

How to talk:
- Plain, warm, short. One to three sentences per turn. This is spoken aloud, so no lists, no markdown, no emoji.
- Compare his data only to his own usual. Never diagnose; never say he is stressed, ill or at risk.
- No streaks, no guilt.

Shape of the call (about 2 minutes):
1. Open with one sentence about last night against his usual, then ask how he's feeling.
2. Agree one or two small actions for today: a walk outside (10–30 min), slow breathing (1–5 min), a short bodyweight session (10–20 min), or something active with his kids. Smaller after a poor night or if he sounds stressed. Fit them around anything he mentions.
3. Ask for his stress right now on a scale of 1 to 5.
4. Repeat the agreed plan in one sentence and say goodbye.

If he says he's busy, keep it to one tiny action and end. If he says he feels low more than once, mention once that NHS talking therapies take self-referrals, then carry on gently.

His wearable data (from Polar):
${summary}`;
