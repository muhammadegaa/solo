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
import { median } from "@/lib/week";
import { compareWeeks } from "@/lib/weekcompare";
import { BedtimeChart, CompareChart, HoursChart, StillChart } from "./charts";
import History, { type HistDay } from "./History";

export const dynamic = "force-dynamic";

const banners: Record<string, string> = {
  connected: "Polar connected.",
  disconnected: "Polar disconnected. Solo no longer has access to your Polar data.",
  denied: "Polar access was not granted.",
  expired: "The Polar connection took too long. Try again.",
  failed: "Could not connect Polar. Try again.",
};

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
const range = (a: string, b: string) => (a.slice(0, 7) === b.slice(0, 7) ? `${fmt(a, { day: "numeric" })}–${fmt(b, { day: "numeric", month: "short" })}` : `${fmt(a, { day: "numeric", month: "short" })} – ${fmt(b, { day: "numeric", month: "short" })}`);
const greeting = (min: number) => (min < 12 * 60 ? "Morning." : min < 18 * 60 ? "Afternoon." : "Evening.");

function Status({ c }: { c: Check }) {
  if (c.kind === "seen") return <small className="ok">Done, {c.steps.toLocaleString("en-GB")} steps on your Loop</small>;
  if (c.kind === "not-seen") return <small className="miss">Not seen on your Loop</small>;
  if (c.kind === "not-synced") return <small>Solo checks your Loop once it syncs</small>;
  return null;
}

const label: Record<string, string> = { bedtime: "Bedtime", mornings: "Movement", still: "Sitting", compare: "What you mentioned" };

function Highlight({ f, days, span }: { f: Finding; days: Day[]; span: string }) {
  const kind = f.id.startsWith("recovery") ? "Recovery" : f.id.startsWith("factor") ? label.compare : label[f.id] ?? "Finding";
  return (
    <article className="hl">
      <span className="hl-k">{kind} · {f.strength === "pattern" ? "pattern" : "early hint"}</span>
      <h3>{f.headline[0]}<em>{f.headline[1]}</em>{f.headline[2]}</h3>
      {f.chart === "bedtime" && <BedtimeChart days={days} />}
      {f.chart === "hours" && <HoursChart days={days} />}
      {f.chart === "still" && <StillChart days={days} at={f.headline[1]} />}
      {f.chart === "compare" && f.compare && <CompareChart compare={f.compare} />}
      <p className="hl-fn">{f.detail} <span>{span}.</span></p>
      {f.suggestion && <span className="hl-try">{f.suggestion}</span>}
    </article>
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
  const lastNight = [...days].reverse().find((d) => d.sleepH !== null);
  const usualSleep = median(days.slice(-15, -1).map((d) => d.sleepH).filter((x): x is number => x !== null));
  const nextSlot = [settings.morning, ...settings.nudges].map((t) => [t, Number(t.slice(0, 2)) * 60 + Number(t.slice(3))] as const).filter(([, m]) => m > now.min).sort((a, b) => a[1] - b[1])[0];
  const syncedTo = today.shape?.syncedTo;
  const firstWithData = days.find((d) => d.sleepH !== null || d.steps !== null || d.said.length) ?? days[0];
  const span = range(firstWithData.date, today.date);
  const highlights = findings(days).filter((f) => f.kind === "finding").slice(0, 3);
  const week = compareWeeks(days, config.activeDaySteps);
  const wm = (l: string) => week.metrics.find((x) => x.label.startsWith(l))!;
  const hist: HistDay[] = days.map((d) => ({
    date: d.date, sleepH: d.sleepH, bed: d.bed, wake: d.wake, steps: d.steps, stress: d.stress,
    firstMove: d.shape?.firstMoveMin ?? null, longestStill: d.shape?.longestStillMin ?? null, longestStillStart: d.shape?.longestStillStart ?? null,
    hourly: d.shape?.hourly ?? null, factors: d.factors, calls: d.calls,
  }));

  return (
    <main className="dv">
      <header className="dv-head">
        <div>
          <p className="dv-eyebrow">{fmt(today.date, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{greeting(now.min)} Here&apos;s what your data says.</h1>
        </div>
        <Link className="dv-settings" href="/settings">Settings</Link>
      </header>
      {polar && banners[polar] && <p className="dv-banner">{banners[polar]}</p>}

      <section className="today" aria-label="Today">
        <div>
          <span className="k">Last night</span>
          {today.sleepH !== null ? (
            <p><b>{today.sleepH} h</b>, in bed {today.bed}, up {today.wake}.{usualSleep !== null ? ` Your usual is ${usualSleep} h.` : ""}</p>
          ) : link ? (
            <p>Last night hasn&apos;t synced yet{lastNight ? <>. <b>{fmt(lastNight.date, { weekday: "long" })}: {lastNight.sleepH} h</b>, in bed {lastNight.bed}, up {lastNight.wake}.</> : "."}</p>
          ) : <p><Link href="/settings">Connect Polar</Link> to see your sleep here.</p>}
        </div>
        <div>
          <span className="k">Today</span>
          {plan.length ? (
            <ul className="plan">{plan.map((p, i) => <li key={i}><time>{p.time ?? "Any time"}</time><span>{p.action}<Status c={p.check} /></span></li>)}</ul>
          ) : <p>{todayCall ? "Nothing agreed today." : "No call yet today. The call picks one small thing from your data."}</p>}
        </div>
        <div className="today-foot">
          <Link className="today-call" href="/call"><i />{todayCall ? "Talk to Solo again" : "Talk to Solo"}</Link>
          <span>{nextSlot ? `Next nudge ${nextSlot[0]}` : link && syncedTo != null ? `Loop synced to ${hhmm(syncedTo)}` : ""}</span>
        </div>
      </section>

      <h2 className="dv-sec">What Solo found</h2>
      {highlights.length ? <div className="hls">{highlights.map((f) => <Highlight key={f.id} f={f} days={days} span={span} />)}</div>
        : <p className="dv-empty">Findings appear after a few days of calls and Loop data. Each call adds to them.</p>}

      <section className="wk" aria-labelledby="wk-h">
        <h2 id="wk-h">This week against last</h2>
        <p>{range(week.thisRange[0], week.thisRange[1])} against {range(week.lastRange[0], week.lastRange[1])}</p>
        <dl>
          {[["Sleep a night", wm("Sleep")], ["Typical bedtime", wm("Bedtime")], ["Walked before noon", wm("Moved")], ["Stress", wm("Stress")]].map(([l, m]) => {
            const x = m as ReturnType<typeof wm>;
            return <div key={l as string}><dt>{l as string}</dt><dd><b>{x.now.replace(" days", "")}</b><small className={x.better === null ? "" : x.better ? "up" : "dn"}>{x.delta ?? `last week ${x.before.replace(" days", "")}`}</small></dd></div>;
          })}
        </dl>
      </section>

      <section className="hist-wrap" aria-labelledby="hist-h">
        <h2 id="hist-h">History</h2>
        <p>Tap a day for its detail.</p>
        <History days={hist} today={today.date} />
        <p className="dv-foot">Data from Polar. <Link href="/dashboard/data">Raw numbers</Link></p>
      </section>
    </main>
  );
}
