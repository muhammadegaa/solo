import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { recentCalls } from "@/lib/calls";
import { config } from "@/lib/config";
import { getDays, type Day } from "@/lib/days";
import { hhmm } from "@/lib/dayshape";
import { findings, type Finding } from "@/lib/findings";
import { checkPlans } from "@/lib/followup";
import type { Check } from "@/lib/plancheck";
import { localNow } from "@/lib/scheduler";
import { getSettings } from "@/lib/settings";
import { getPolarLink } from "@/lib/store";
import { median, nightMinutes } from "@/lib/week";
import { compareWeeks } from "@/lib/weekcompare";

export const dynamic = "force-dynamic";

const banners: Record<string, string> = {
  connected: "Polar connected.",
  disconnected: "Polar disconnected. Solo no longer has access to your Polar data.",
  denied: "Polar access was not granted.",
  expired: "The Polar connection took too long. Try again.",
  failed: "Could not connect Polar. Try again.",
};

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const dayMonth = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const range = ([a, b]: [string, string]) => {
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
  return a.slice(0, 7) === b.slice(0, 7) ? `${day(a)}–${dayMonth(b)}` : `${dayMonth(a)} – ${dayMonth(b)}`;
};

// Sleep bars sit on a 21:00 to 09:00 axis.
const AXIS_START = 21 * 60, AXIS_LEN = 12 * 60;
const axisPosMin = (mins: number) => Math.max(0, Math.min(100, ((mins - AXIS_START) / AXIS_LEN) * 100));
const axisPos = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return axisPosMin((h < 12 ? h + 24 : h) * 60 + m);
};

function Status({ c }: { c: Check }) {
  if (c.kind === "seen") return <span className="st ok">Done · {c.steps.toLocaleString("en-GB")} steps</span>;
  if (c.kind === "not-seen") return <span className="st miss">Not seen on your Loop</span>;
  if (c.kind === "not-synced") return <span className="st">Waiting for Loop sync</span>;
  return null;
}

function FindingCard({ f, span }: { f: Finding; span: string }) {
  const max = f.compare ? Math.max(f.compare.a.value, f.compare.b.value) || 1 : 1;
  return (
    <article className="fd">
      <div className="fd-top"><span className={`fd-chip ${f.strength}`}>{f.strength === "pattern" ? "Pattern" : "Early hint"}</span><span className="fd-span">{span}</span></div>
      <h3>{f.title}</h3>
      <p>{f.detail}</p>
      {f.compare && (
        <div className="fd-bars">
          {[f.compare.a, f.compare.b].map((c, i) => (
            <div className="fd-bar" key={i}>
              <span className="fd-bl">{c.label} <small>· {c.n} {c.n === 1 ? "day" : "days"}</small></span>
              <span className="fd-bt"><i className={i === 0 ? "a" : "b"} style={{ width: `${(c.value / max) * 100}%` }} /></span>
              <span className="fd-bv">{c.value}</span>
            </div>
          ))}
          <span className="fd-unit">{f.compare.unit}</span>
        </div>
      )}
      {f.suggestion && <p className="fd-try">Try: {f.suggestion}</p>}
    </article>
  );
}

function DayRow({ d, usualBedPos, today }: { d: Day; usualBedPos: number | null; today: string }) {
  const first = d.shape?.firstMoveMin;
  const finished = (d.shape?.syncedTo ?? 0) >= 20 * 60;
  return (
    <li className="dr">
      <div className="dr-date"><b>{d.date === today ? "Today" : weekday(d.date)}</b><span>{dayMonth(d.date)}</span></div>
      <div className="dr-main">
        <div className="dr-sleep">
          <div className="dr-track">
            {usualBedPos !== null && <i className="dr-usual" style={{ left: `${usualBedPos}%` }} />}
            {d.bed && d.wake ? <span className="dr-bar" style={{ left: `${axisPos(d.bed)}%`, width: `${Math.max(2, axisPos(d.wake) - axisPos(d.bed))}%` }} />
              : <span className="dr-none">{d.date === today ? "not synced yet" : "no sleep data"}</span>}
          </div>
          <span className="dr-h">{d.sleepH !== null ? `${d.sleepH} h` : ""}</span>
        </div>
        {d.bed && d.wake && <div className="dr-times">{d.bed} to {d.wake}</div>}
        <div className="dr-tags">
          {first != null && <span className={first < 720 ? "tg good" : "tg"}>first walk {hhmm(first)}</span>}
          {d.shape && first == null && finished && <span className="tg">no 10-min walk</span>}
          {d.steps !== null && <span className="tg">{d.steps.toLocaleString("en-GB")} steps{d.date === today ? " so far" : ""}</span>}
          {d.stress !== null && <span className="tg stress">stress {d.stress}</span>}
          {d.factors.filter((f) => !f.startsWith("felt")).map((f) => <span className="tg said" key={f}>{f}</span>)}
        </div>
        {d.calls.map((c, i) => <p className="dr-call" key={i}><b>{c.time}</b> {c.summary}</p>)}
      </div>
    </li>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ polar?: string }> }) {
  const user = await requireUser();
  const { polar } = await searchParams;
  const link = await getPolarLink(user.uid);
  const [days, calls, settings] = await Promise.all([getDays(user.uid, link?.accessToken ?? null), recentCalls(user.uid, 2), getSettings(user.uid)]);
  const now = localNow(config.timeZone);
  const today = days[days.length - 1];
  const todayCall = calls.find((c) => c.localDate === today.date && c.plan.length);
  const plan = todayCall ? (await checkPlans(link?.accessToken ?? null, [todayCall]))[0].items : [];
  const past = days.slice(-15, -1);
  const usualSleep = median(past.map((d) => d.sleepH).filter((x): x is number => x !== null));
  const usualBed = median(past.filter((d) => d.bed).map((d) => nightMinutes(d.bed!))); // minutes after 22:00
  const usualBedPos = usualBed === null ? null : axisPosMin(usualBed + 22 * 60);
  const usualBedClock = usualBed === null ? null : hhmm((Math.round(usualBed) + 22 * 60) % 1440);
  const nextSlot = [settings.morning, ...settings.nudges].map((t) => [t, Number(t.slice(0, 2)) * 60 + Number(t.slice(3))] as const).filter(([, m]) => m > now.min).sort((a, b) => a[1] - b[1])[0];
  const syncedTo = today.shape?.syncedTo;
  const cards = findings(days).filter((f) => f.kind === "finding").slice(0, 3);
  const firstWithData = days.find((d) => d.sleepH !== null || d.steps !== null || d.said.length) ?? days[0];
  const span = range([firstWithData.date, today.date]);
  const week = compareWeeks(days, config.activeDaySteps);
  const timeline = days.slice(-14).reverse();

  return (
    <main className="dv">
      <header className="dv-head">
        <div>
          <p className="dv-eyebrow">{link ? (syncedTo != null ? `Loop synced up to ${hhmm(syncedTo)}` : "Loop hasn't synced today") : "No wearable connected"}</p>
          <h1>{longDate(today.date)}</h1>
        </div>
        <Link className="dv-settings" href="/settings">Settings</Link>
      </header>
      {polar && banners[polar] && <p className="dv-banner">{banners[polar]}</p>}

      <section className="today" aria-label="Today">
        <div className="today-night">
          <span className="k">Last night</span>
          {today.sleepH !== null ? (
            <p><b>{today.sleepH} h</b> <span>{today.bed} to {today.wake}{usualSleep !== null ? `. Your usual is ${usualSleep} h.` : ""}</span></p>
          ) : <p><span>{link ? "Not synced yet. Open Polar Flow on your phone to sync." : <Link href="/settings">Connect Polar to see your sleep</Link>}</span></p>}
        </div>
        <div className="today-plan">
          <span className="k">Today&apos;s plan</span>
          {plan.length ? (
            <ul>{plan.map((p, i) => <li key={i}><time>{p.time ?? "any time"}</time><span className="a">{p.action}</span><Status c={p.check} /></li>)}</ul>
          ) : <p><span>{todayCall ? "Nothing agreed today." : "No call yet today. The call sets a plan from your data."}</span></p>}
        </div>
        <div className="today-foot">
          <Link className="today-call" href="/call"><i />{todayCall ? "Call again" : "Start check-in call"}</Link>
          {nextSlot && <span>Next reminder at {nextSlot[0]}</span>}
        </div>
      </section>

      <section className="sec" aria-labelledby="only-h">
        <div className="sec-h"><h2 id="only-h">Only in Solo</h2><p>Your Loop data combined with what you&apos;ve told Solo. Your wearable app doesn&apos;t show these.</p></div>
        {cards.length ? <div className="fds">{cards.map((f) => <FindingCard key={f.id} f={f} span={span} />)}</div>
          : <p className="empty">Findings appear after a few days of calls and Loop data.</p>}
      </section>

      <section className="sec" aria-labelledby="week-h">
        <div className="sec-h"><h2 id="week-h">This week against last week</h2><p>{range(week.thisRange)} against {range(week.lastRange)}</p></div>
        <dl className="wk">
          {week.metrics.map((m) => (
            <div className="wk-row" key={m.label}>
              <dt>{m.label}<small>{m.note}</small></dt>
              <dd><b>{m.now}</b><span className={m.better === null ? "wk-d" : m.better ? "wk-d up" : "wk-d down"}>{m.delta ?? `last week ${m.before}`}</span></dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="sec" aria-labelledby="days-h">
        <div className="sec-h"><h2 id="days-h">Last 14 days</h2><p>Each night drawn from 21:00 to 09:00{usualBedClock ? `. The orange line is your usual bedtime, ${usualBedClock}.` : "."}</p></div>
        <div className="dr-axis" aria-hidden="true"><span /><div><span>21:00</span><span>00:00</span><span>03:00</span><span>06:00</span><span>09:00</span></div></div>
        <ol className="drs">{timeline.map((d) => <DayRow key={d.date} d={d} usualBedPos={usualBedPos} today={today.date} />)}</ol>
        <p className="dv-foot">Data from Polar. <Link href="/dashboard/data">Raw numbers</Link></p>
      </section>

    </main>
  );
}
