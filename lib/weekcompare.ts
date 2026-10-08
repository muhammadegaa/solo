// Pure: this week against last week, from the per-day rows.
import type { Day } from "./days";
import { median, nightMinutes } from "./week";

export type Metric = { label: string; now: string; before: string; delta: string | null; better: boolean | null; note: string };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number");
const clockFromNight = (m: number) => {
  const t = (Math.round(m) + 22 * 60) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function compareWeeks(days: Day[], activeSteps: number): { thisRange: [string, string]; lastRange: [string, string]; metrics: Metric[] } {
  const cur = days.slice(-7), prev = days.slice(-14, -7);

  const sleepNow = avg(nums(cur.map((d) => d.sleepH))), sleepBefore = avg(nums(prev.map((d) => d.sleepH)));
  const bedNow = median(cur.filter((d) => d.bed).map((d) => nightMinutes(d.bed!)));
  const bedBefore = median(prev.filter((d) => d.bed).map((d) => nightMinutes(d.bed!)));
  // The current day's steps are partial until it ends, so active days only count finished days.
  const active = (xs: Day[]) => xs.filter((d) => (d.steps ?? 0) >= activeSteps).length;
  const early = (xs: Day[]) => xs.filter((d) => d.shape?.firstMoveMin != null && d.shape.firstMoveMin < 720).length;
  const stressNow = avg(nums(cur.map((d) => d.stress))), stressBefore = avg(nums(prev.map((d) => d.stress)));

  const metrics: Metric[] = [];
  const f1 = (x: number | null) => (x === null ? "—" : x.toFixed(1));

  metrics.push({
    label: "Sleep", now: sleepNow === null ? "—" : `${f1(sleepNow)} h`, before: sleepBefore === null ? "—" : `${f1(sleepBefore)} h`,
    delta: sleepNow !== null && sleepBefore !== null ? `${sleepNow >= sleepBefore ? "+" : "−"}${Math.abs(sleepNow - sleepBefore).toFixed(1)} h` : null,
    better: sleepNow !== null && sleepBefore !== null && Math.abs(sleepNow - sleepBefore) >= 0.1 ? sleepNow > sleepBefore : null,
    note: "average a night",
  });
  metrics.push({
    label: "Bedtime", now: bedNow === null ? "—" : clockFromNight(bedNow), before: bedBefore === null ? "—" : clockFromNight(bedBefore),
    delta: bedNow !== null && bedBefore !== null && Math.round(Math.abs(bedNow - bedBefore)) >= 5 ? `${Math.round(Math.abs(bedNow - bedBefore))} min ${bedNow > bedBefore ? "later" : "earlier"}` : bedNow !== null && bedBefore !== null ? "about the same" : null,
    better: bedNow !== null && bedBefore !== null && Math.abs(bedNow - bedBefore) >= 5 ? bedNow < bedBefore : null,
    note: "typical night",
  });
  metrics.push({
    label: "Moved before noon", now: `${early(cur)} of ${cur.filter((d) => d.shape).length} days`, before: `${early(prev)} of ${prev.filter((d) => d.shape).length} days`,
    delta: null, better: early(cur) === early(prev) ? null : early(cur) > early(prev), note: "a 10-minute walk or more",
  });
  metrics.push({
    label: `Days over ${activeSteps.toLocaleString("en-GB")} steps`, now: `${active(cur.slice(0, -1))} of 6`, before: `${active(prev.slice(1))} of 6`,
    delta: null, better: active(cur.slice(0, -1)) === active(prev.slice(1)) ? null : active(cur.slice(0, -1)) > active(prev.slice(1)), note: "finished days only",
  });
  metrics.push({
    label: "Stress", now: stressNow === null ? "—" : `${f1(stressNow)} of 5`, before: stressBefore === null ? "—" : `${f1(stressBefore)} of 5`,
    delta: null, better: stressNow !== null && stressBefore !== null && Math.abs(stressNow - stressBefore) >= 0.3 ? stressNow < stressBefore : null,
    note: `from ${nums(cur.map((d) => d.stress)).length} rated days`,
  });

  return { thisRange: [cur[0].date, cur[cur.length - 1].date], lastRange: [prev[0]?.date ?? cur[0].date, prev[prev.length - 1]?.date ?? cur[0].date], metrics };
}
