// Pure: personal findings from combined Loop data and what the user said in calls.
// Each one is something the wearable app alone doesn't show: comparisons across days, or body data joined with life context.
import { hhmm } from "./dayshape";
import type { Day } from "./days";
import { median, nightMinutes } from "./week";

export type Compare = { label: string; value: number; n: number };
export type Finding = {
  id: string;
  kind: "finding" | "question";
  strength: "hint" | "pattern"; // hint: under 4 days per side
  title: string; // short label, e.g. on the call screen
  headline: [string, string, string]; // the answer as a sentence: before, emphasised part, after
  chart?: "bedtime" | "hours" | "still" | "compare";
  detail: string; // spoken in calls and used as the footnote basis
  compare?: { unit: string; a: Compare; b: Compare };
  suggestion?: string;
  score: number;
};

const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const strength = (a: number, b: number) => (Math.min(a, b) >= 4 ? "pattern" : "hint") as Finding["strength"];
const next = (days: Day[], i: number) => days[i + 1];

function bedtime(days: Day[]): Finding | null {
  const rated = days.filter((d) => d.bed && d.sleepH !== null);
  const early = rated.filter((d) => nightMinutes(d.bed!) <= 60).map((d) => d.sleepH!);
  const late = rated.filter((d) => nightMinutes(d.bed!) >= 120).map((d) => d.sleepH!);
  if (early.length < 2 || late.length < 2) return null;
  const e = avg(early), l = avg(late);
  if (e - l < 0.5) return null;
  return {
    id: "bedtime", kind: "finding", strength: strength(early.length, late.length),
    title: "Bed by 23:00 or after midnight",
    headline: ["You sleep ", `${(e - l).toFixed(1)} hours more`, " when you're in bed by 23:00."],
    chart: "bedtime",
    detail: `In bed by 23:00 you slept ${e} h on average (${early.length} nights). After midnight, ${l} h (${late.length} nights).`,
    compare: { unit: "h sleep", a: { label: "By 23:00", value: e, n: early.length }, b: { label: "After 00:00", value: l, n: late.length } },
    suggestion: "In bed by 23:00 tonight",
    score: e - l,
  };
}

function mornings(days: Day[]): Finding | null {
  const synced = days.filter((d) => d.shape && (d.shape.syncedTo ?? 0) >= 13 * 60);
  if (synced.length < 5) return null;
  const late = synced.filter((d) => d.shape!.firstMoveMin === null || d.shape!.firstMoveMin >= 720);
  const share = late.length / synced.length;
  if (share < 0.4) return null;
  const early = synced.filter((d) => !late.includes(d));
  const s = (xs: Day[]) => xs.map((d) => d.stress).filter((x): x is number => x !== null);
  const withStress = s(early).length >= 2 && s(late).length >= 2;
  return {
    id: "mornings", kind: "finding", strength: synced.length >= 10 ? "pattern" : "hint",
    title: "Still mornings",
    headline: ["Most of your walking happens ", "after lunch", "."],
    chart: "hours",
    detail: `On ${late.length} of the last ${synced.length} days your first walk of 10 minutes or more came after noon.` +
      (withStress ? ` Your stress averaged ${avg(s(late))} on those days and ${avg(s(early))} on days you moved before noon.` : ""),
    compare: withStress ? { unit: "stress (1-5)", a: { label: "Moved before noon", value: avg(s(early)), n: s(early).length }, b: { label: "After noon", value: avg(s(late)), n: s(late).length } } : undefined,
    suggestion: "A 10-minute walk before 10:00",
    score: share,
  };
}

function recovery(days: Day[]): Finding | null {
  const usualSleep = median(days.map((d) => d.sleepH).filter((x): x is number => x !== null));
  const usualHrv = median(days.map((d) => d.hrv).filter((x): x is number => x !== null));
  if (usualSleep === null || usualHrv === null) return null;
  const recent = days.slice(-4).reverse();
  const hit = recent.find((d) => d.sleepH !== null && d.sleepH <= usualSleep - 0.7 && ((d.ans ?? 0) >= 3 || (d.hrv ?? 0) >= usualHrv * 1.08));
  if (!hit) return null;
  const i = days.indexOf(hit);
  const ctx = [...new Set([...(days[i - 1]?.factors ?? []), ...hit.factors])];
  return {
    id: `recovery-${hit.date}`, kind: "finding", strength: "hint",
    title: "Short sleep, good recovery",
    headline: [`${fmtDate(hit.date)}: `, `${hit.sleepH} h of sleep`, ", but your body still recovered well."],
    detail: `On ${fmtDate(hit.date)} you slept ${hit.sleepH} h, under your usual ${usualSleep} h, but your body recovered well overnight: HRV ${hit.hrv ?? "?"} ms against your usual ${usualHrv}${hit.ans !== null ? `, ANS charge ${hit.ans > 0 ? "+" : ""}${hit.ans}` : ""}.` +
      (ctx.length ? ` Around then you mentioned: ${ctx.join(", ")}.` : ""),
    score: recent.indexOf(hit) <= 1 ? 1.2 : 0.7,
  };
}

function stillStretch(days: Day[]): Finding | null {
  const synced = days.slice(-7).filter((d) => d.shape && (d.shape.syncedTo ?? 0) >= 20 * 60);
  const long = synced.filter((d) => d.shape!.longestStillMin >= 60);
  if (long.length < 3) return null;
  const start = median(long.map((d) => d.shape!.longestStillStart!))!;
  const dur = median(long.map((d) => d.shape!.longestStillMin))!;
  const at = hhmm(Math.round(start / 15) * 15);
  return {
    id: "still", kind: "finding", strength: long.length >= 4 ? "pattern" : "hint",
    title: "Your longest still stretch",
    headline: ["Your longest sit starts around ", at, "."],
    chart: "still",
    detail: `On ${long.length} of the last ${synced.length} days you sat still for over an hour at a time, usually starting around ${at} and lasting about ${Math.round(dur / 6) / 10} h.`,
    suggestion: `Get up and walk for 5 minutes at ${at}`,
    score: 0.5 + long.length / 14,
  };
}

function factorFindings(days: Day[]): Finding[] {
  const callDays = days.filter((d) => d.said.length);
  // How he felt is an outcome, not a cause, so it's never tracked as a factor.
  const outcomes = new Set(["felt fresh", "felt tired", "felt low"]);
  const factors = [...new Set(callDays.flatMap((d) => d.factors))].filter((f) => !outcomes.has(f));
  const out: Finding[] = [];
  for (const f of factors) {
    const withF = callDays.filter((d) => d.factors.includes(f));
    const without = callDays.filter((d) => !d.factors.includes(f));
    const nightAfter = (xs: Day[]) => xs.map((d) => next(days, days.indexOf(d))?.sleepH).filter((x): x is number => typeof x === "number");
    const a = nightAfter(withF), b = nightAfter(without);
    if (a.length >= 2 && b.length >= 2 && Math.abs(avg(a) - avg(b)) >= 0.4) {
      out.push({
        id: `factor-${f}`, kind: "finding", strength: strength(a.length, b.length),
        title: `Days with “${f}”`,
        headline: [`After days with “${f}”, you sleep `, `${Math.abs(avg(a) - avg(b)).toFixed(1)} h ${avg(a) > avg(b) ? "more" : "less"}`, "."],
        chart: "compare",
        detail: `After days you mentioned “${f}”, you slept ${avg(a)} h (${a.length} nights); after other days, ${avg(b)} h (${b.length}).`,
        compare: { unit: "h sleep after", a: { label: f, value: avg(a), n: a.length }, b: { label: "Other days", value: avg(b), n: b.length } },
        score: Math.abs(avg(a) - avg(b)),
      });
    } else {
      out.push({
        id: `ask-${f}`, kind: "question", strength: "hint",
        title: `Tracking “${f}”`,
        headline: ["Tracking ", `“${f}”`, ""],
        detail: `He has mentioned “${f}” on ${withF.length} day(s). Ask once, naturally, whether it applied yesterday or today, so its effect on his sleep and stress can be compared.`,
        score: 0.3,
      });
    }
  }
  return out;
}

export function findings(days: Day[]): Finding[] {
  return [bedtime(days), mornings(days), recovery(days), stillStretch(days), ...factorFindings(days)]
    .filter((f): f is Finding => f !== null)
    .sort((x, y) => (x.kind === y.kind ? y.score - x.score : x.kind === "finding" ? -1 : 1));
}

// For a call: the best finding not used recently, plus one question to ask.
export function pickForCall(all: Finding[], shown: Record<string, string>, today: string, repeatDays: number) {
  const fresh = (f: Finding) => {
    const last = shown[f.id];
    return !last || (Date.parse(today) - Date.parse(last)) / 86_400_000 >= repeatDays;
  };
  return {
    finding: all.find((f) => f.kind === "finding" && fresh(f)) ?? null,
    question: all.find((f) => f.kind === "question" && fresh(f)) ?? null,
  };
}
