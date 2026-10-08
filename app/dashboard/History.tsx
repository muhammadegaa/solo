"use client";

import { useState } from "react";

export type HistDay = {
  date: string;
  sleepH: number | null;
  bed: string | null;
  wake: string | null;
  steps: number | null;
  stress: number | null;
  firstMove: number | null;
  longestStill: number | null;
  longestStillStart: number | null;
  hourly: number[] | null;
  factors: string[];
  calls: { time: string; summary: string }[];
};

type Range = 7 | 14 | 28;
type View = "sleep" | "bedtime" | "steps";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
const bedMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };

// Each view: the value shown in a day's square, and its colour (background, text) from dark = better to light.
const views: Record<View, { label: string; value: (d: HistDay) => string | null; shade: (d: HistDay) => [string, string] | null; legend: [string, string][] }> = {
  sleep: {
    label: "Sleep",
    value: (d) => (d.sleepH === null ? null : String(d.sleepH)),
    shade: (d) => d.sleepH === null ? null : d.sleepH >= 7 ? ["#2c3657", "#f6efe6"] : d.sleepH >= 6 ? ["#5d6a94", "#f6efe6"] : d.sleepH >= 5 ? ["#a8b1cc", "#1b2130"] : ["#dfe3ee", "#1b2130"],
    legend: [["#2c3657", "7 h+"], ["#5d6a94", "6–7"], ["#a8b1cc", "5–6"], ["#dfe3ee", "under 5"]],
  },
  bedtime: {
    label: "Bedtime",
    value: (d) => d.bed,
    shade: (d) => !d.bed ? null : bedMin(d.bed) <= 23 * 60 ? ["#b4622f", "#fff"] : bedMin(d.bed) < 24 * 60 ? ["#e0a578", "#1b2130"] : bedMin(d.bed) < 25 * 60 ? ["#f1d2b6", "#1b2130"] : ["#f8e9dc", "#1b2130"],
    legend: [["#b4622f", "by 23:00"], ["#e0a578", "23–00"], ["#f1d2b6", "00–01"], ["#f8e9dc", "after 01"]],
  },
  steps: {
    label: "Steps",
    value: (d) => (d.steps === null ? null : `${(d.steps / 1000).toFixed(1)}k`),
    shade: (d) => d.steps === null ? null : d.steps >= 9000 ? ["#2f6b3d", "#fff"] : d.steps >= 7000 ? ["#5f9a6d", "#fff"] : d.steps >= 5000 ? ["#b7d6bd", "#1b2130"] : ["#e3f1e6", "#1b2130"],
    legend: [["#2f6b3d", "9k+"], ["#5f9a6d", "7–9k"], ["#b7d6bd", "5–7k"], ["#e3f1e6", "under 5k"]],
  },
};

function DayStrip({ d }: { d: HistDay }) {
  // 21:00 the evening before to 21:00 on the day.
  const pos = (min: number, prevEvening: boolean) => (((prevEvening ? min - 1260 : min + 180) / 1440) * 100);
  const max = Math.max(1, ...(d.hourly ?? [0]));
  let sleep = null;
  if (d.bed && d.wake) {
    const b = bedMin(d.bed) >= 24 * 60 ? pos(bedMin(d.bed) - 1440, false) : pos(bedMin(d.bed), true);
    const [wh, wm] = d.wake.split(":").map(Number);
    sleep = <span className="sp-sl" style={{ left: `${b}%`, width: `${pos(wh * 60 + wm, false) - b}%` }} />;
  }
  return (
    <div className="sp">
      <div className="sp-strip">
        <span className="sp-mid" style={{ left: `${pos(720, false)}%` }} />
        {sleep}
        {d.hourly?.map((s, h) => s > 40 && <span key={h} className="sp-hb" style={{ left: `${pos(h * 60, false)}%`, height: `${Math.max(2, (s / max) * 18)}px` }} />)}
        {d.longestStill !== null && d.longestStill >= 60 && d.longestStillStart !== null && <span className="sp-st" style={{ left: `${pos(d.longestStillStart, false)}%`, width: `${d.longestStill / 14.4}%` }} />}
        {d.calls.map((c, i) => { const [h, m] = c.time.split(":").map(Number); return <span key={i} className="sp-cm" style={{ left: `${pos(h * 60 + m, false)}%` }} />; })}
      </div>
      <div className="sp-ax"><span>21:00</span><span>03:00</span><span>09:00</span><span>15:00</span><span>21:00</span></div>
    </div>
  );
}

export default function History({ days, today }: { days: HistDay[]; today: string }) {
  const [range, setRange] = useState<Range>(14);
  const [view, setView] = useState<View>("sleep");
  // Never show days before the first one with any data; the range grows into 4 weeks as data builds up.
  const firstData = Math.max(0, days.findIndex((d) => d.sleepH !== null || d.steps !== null || d.calls.length > 0));
  const shown = days.slice(Math.max(firstData, days.length - range));
  const lastWithData = [...shown].reverse().find((d) => d.sleepH !== null || d.steps !== null) ?? shown[shown.length - 1];
  const [selected, setSelected] = useState(lastWithData.date);
  const sel = days.find((d) => d.date === selected) ?? lastWithData;
  const v = views[view];
  const lead = (new Date(`${shown[0].date}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday first

  return (
    <div className="hist">
      <div className="hist-ctl">
        <div className="seg" role="group" aria-label="Range">
          {([7, 14, 28] as Range[]).map((r) => <button key={r} id={`range-${r}`} aria-pressed={range === r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === 7 ? "1 week" : r === 14 ? "2 weeks" : "4 weeks"}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Show">
          {(Object.keys(views) as View[]).map((k) => <button key={k} id={`view-${k}`} aria-pressed={view === k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{views[k].label}</button>)}
        </div>
      </div>

      <div className="cal">
        {["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <span key={i} className="cal-wd">{x}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {shown.map((d) => {
          const shade = v.shade(d), val = v.value(d), early = d.firstMove !== null && d.firstMove < 720;
          return (
            <button key={d.date} id={`day-${d.date}`} className={`cell${shade ? "" : " empty"}${d.date === sel.date ? " sel" : ""}`} style={shade ? { background: shade[0], color: shade[1] } : undefined}
              aria-label={`${fmt(d.date, { weekday: "long", day: "numeric", month: "long" })}: ${v.label} ${val ?? "no data"}`} aria-pressed={d.date === sel.date} onClick={() => setSelected(d.date)}>
              <span className="cell-n">{fmt(d.date, { day: "numeric" })}</span>
              <span className="cell-v">{val ?? (d.date === today ? "today" : "–")}</span>
              {early && <i className="cell-dot" />}
              {d.calls.length > 0 && <i className="cell-call" />}
            </button>
          );
        })}
      </div>
      <div className="leg">
        {v.legend.map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
        <span><i className="leg-dot" />walked before noon</span>
        <span><i className="leg-call" />call</span>
      </div>

      <div className="day" aria-live="polite">
        <div className="day-h">
          <b>{sel.date === today ? "Today" : fmt(sel.date, { weekday: "long" })}</b>
          <span>{fmt(sel.date, { day: "numeric", month: "long" })}</span>
        </div>
        <DayStrip d={sel} />
        <dl className="day-n">
          <div><dt>Sleep</dt><dd>{sel.sleepH !== null ? `${sel.sleepH} h` : "—"}</dd></div>
          <div><dt>In bed</dt><dd>{sel.bed && sel.wake ? `${sel.bed}–${sel.wake}` : "—"}</dd></div>
          <div><dt>Steps</dt><dd>{sel.steps !== null ? sel.steps.toLocaleString("en-GB") : "—"}</dd></div>
          <div><dt>First walk</dt><dd>{sel.firstMove !== null ? hhmm(sel.firstMove) : "—"}</dd></div>
          <div><dt>Longest sit</dt><dd>{sel.longestStill !== null && sel.longestStill >= 30 && sel.longestStillStart !== null ? `${Math.round(sel.longestStill / 6) / 10} h from ${hhmm(sel.longestStillStart)}` : "—"}</dd></div>
          <div><dt>Stress</dt><dd>{sel.stress !== null ? `${sel.stress} of 5` : "—"}</dd></div>
        </dl>
        {sel.factors.filter((f) => !f.startsWith("felt")).length > 0 && <div className="day-tags">{sel.factors.filter((f) => !f.startsWith("felt")).map((f) => <span key={f}>{f}</span>)}</div>}
        {sel.calls.map((c, i) => <p className="day-call" key={i}><b>{c.time}</b> {c.summary}</p>)}
        <p className="day-key">Dark bar: sleep. Orange: steps each hour. Grey line: your longest sit. Circle: a call.</p>
      </div>
    </div>
  );
}
