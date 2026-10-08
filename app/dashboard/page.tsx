import SignOut from "@/app/SignOut";
import { requireUser } from "@/lib/auth";
import { recentCalls } from "@/lib/calls";
import { config } from "@/lib/config";
import { checkPlans } from "@/lib/followup";
import type { Check } from "@/lib/plancheck";
import { fetchRaw, toRows, type DayRow } from "@/lib/polar";
import { getDays } from "@/lib/days";
import { findings, type Finding } from "@/lib/findings";
import { getSettings } from "@/lib/settings";
import { getPolarLink } from "@/lib/store";
import Reminders from "./Reminders";
import { WINDOW_MIN, clock, dailyAverage, lastDates, median, nightMinutes, sleepBar, trendTitle, weekdayLetter, weekdayShort } from "@/lib/week";

export const dynamic = "force-dynamic";

function FindingCard({ f }: { f: Finding }) {
  const max = f.compare ? Math.max(f.compare.a.value, f.compare.b.value) || 1 : 1;
  return (
    <article className="finding">
      <header><h3>{f.title}</h3><span className={`chip ${f.strength}`}>{f.strength === "pattern" ? "Pattern" : "Early hint"}</span></header>
      <p>{f.detail}</p>
      {f.compare && (
        <div className="bars" aria-label={`${f.compare.a.label} ${f.compare.a.value} ${f.compare.unit}, ${f.compare.b.label} ${f.compare.b.value}`}>
          {[f.compare.a, f.compare.b].map((c, i) => (
            <div className="bar" key={i}>
              <span className="bar-l">{c.label}</span>
              <span className="bar-t"><i style={{ width: `${(c.value / max) * 100}%` }} className={i === 0 ? "a" : "b"} /></span>
              <span className="bar-v">{c.value} <small>{f.compare!.unit}</small></span>
            </div>
          ))}
        </div>
      )}
      {f.suggestion && <p className="try">Try: {f.suggestion}</p>}
    </article>
  );
}

function Status({ c }: { c: Check }) {
  if (c.kind === "seen") return <span className="pill ok">Done · {c.steps.toLocaleString("en-GB")} steps</span>;
  if (c.kind === "not-seen") return <span className="pill wait">Not seen on Loop</span>;
  if (c.kind === "not-synced") return <span className="pill">Waiting for Loop sync</span>;
  return null;
}

const banners: Record<string, string> = {
  connected: "Polar connected.",
  disconnected: "Polar disconnected. Solo no longer has access to your Polar data.",
  denied: "Polar access was not granted.",
  expired: "The Polar connection took too long. Try again.",
  failed: "Could not connect Polar. Try again.",
};

function StressChart({ dates, values }: { dates: string[]; values: (number | null)[] }) {
  const x = (i: number) => 34 + i * ((310 - 34) / (dates.length - 1));
  const y = (v: number) => 20 + (5 - v) * 25; // 5 at the top, 1 at the bottom
  const pts = values.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v })).filter((p): p is { x: number; y: number; v: number } => p !== null);
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="chart" viewBox="0 0 320 146" role="img" aria-label={`Daily stress, oldest first: ${values.map((v) => v ?? "none").join(", ")}`}>
      {[5, 3, 1].map((v) => (
        <g key={v}><line x1="26" y1={y(v)} x2="316" y2={y(v)} className="grid" /><text x="8" y={y(v) + 4}>{v}</text></g>
      ))}
      {pts.length > 1 && <path className="area" d={`M${pts[0].x} ${y(1)} L${line.replaceAll(" ", " L")} L${last.x} ${y(1)} Z`} />}
      {pts.length > 1 && <polyline className="line" points={line} />}
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p === last ? 5.5 : 3.5} className={p === last ? "end" : "dot"} />)}
      {dates.map((d, i) => <text key={d} x={x(i) - 4} y="140">{weekdayLetter(d)}</text>)}
    </svg>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ polar?: string }> }) {
  const user = await requireUser();
  const { polar } = await searchParams;
  const dates = lastDates(7, config.timeZone);
  const today = dates[dates.length - 1];

  const [calls, link, settings] = await Promise.all([recentCalls(user.uid, 8), getPolarLink(user.uid), getSettings(user.uid)]);
  const insights = findings(await getDays(user.uid, link?.accessToken ?? null)).filter((f) => f.kind === "finding").slice(0, 3);
  const rows: DayRow[] = link ? await fetchRaw(link.accessToken, 14).then((r) => toRows(r, 14)).catch(() => []) : [];
  const polarDown = Boolean(link) && rows.length === 0;

  const weekCalls = calls.filter((c) => dates.includes(c.localDate));
  const stress = dailyAverage(weekCalls.map((c) => ({ localDate: c.localDate, value: c.stress })), dates);
  const todayCall = calls.find((c) => c.localDate === today && c.plan.length);
  const todayChecked = todayCall ? (await checkPlans(link?.accessToken ?? null, [todayCall]))[0].items : [];

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const week = dates.map((d) => byDate.get(d));
  const sleeps = week.map((r) => r?.sleepH).filter((x): x is number => typeof x === "number");
  const avgSleep = sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : null;
  const activeDays = week.filter((r) => (r?.steps ?? 0) >= config.activeDaySteps).length;
  const usualBed = median(rows.map((r) => r.bed).filter((b): b is string => Boolean(b)).map(nightMinutes));

  return (
    <main className="db">
      <header className="db-head">
        <div>
          <span className="db-eyebrow">Week to {weekdayShort(today)} {Number(today.slice(8))}</span>
          <h1>{trendTitle(stress)}</h1>
        </div>
        <span className="db-user">{user.email} · <SignOut /></span>
      </header>
      {polar && banners[polar] && <p className="db-banner">{banners[polar]}</p>}

      <section className="only">
        <h2>Only in Solo <span>What your wearable app alone doesn&apos;t show</span></h2>
        {insights.length ? <div className="findings">{insights.map((f) => <FindingCard key={f.id} f={f} />)}</div>
          : <p>Findings appear after a few days of calls and Loop data. Each call adds to them.</p>}
      </section>

      <div className="db-grid">
        <section className="tile wide">
          <h2>Stress, daily average</h2>
          {stress.some((v) => v !== null) ? <StressChart dates={dates} values={stress} /> : <p>Your stress ratings from calls will show here. Start a call to add the first one.</p>}
        </section>

        <section className="tile">
          <h2>Today</h2>
          {todayCall ? (
            <ul className="plan">{todayChecked.map((p, i) => <li key={i}><time>{p.time ?? "any time"}</time><span>{p.action} <Status c={p.check} /></span></li>)}</ul>
          ) : <p>No plan yet today.</p>}
        </section>

        <div className="stats">
          <div className="stat"><span>Calls</span><b>{weekCalls.length}</b></div>
          <div className="stat"><span>Avg sleep</span><b>{avgSleep ? `${avgSleep} h` : "—"}</b></div>
          <div className="stat"><span>Active days</span><b>{link ? `${activeDays} / 7` : "—"}</b></div>
        </div>

        <section className="tile">
          <h2>Sleep timing</h2>
          {!link && <p>Connect Polar to see when you sleep.</p>}
          {polarDown && <p>Polar did not respond. Reload in a minute.</p>}
          {rows.length > 0 && (
            <>
              <div className="nights">
                {dates.map((d) => {
                  const r = byDate.get(d);
                  const bar = r ? sleepBar(r.bed, r.wake) : null;
                  return (
                    <div className="night" key={d}>
                      <span>{weekdayShort(d)}</span>
                      <div className="trk" title={r?.bed ? `${r.bed}–${r.wake}` : "no data"}>
                        {bar && <span style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />}
                        {usualBed !== null && <b style={{ left: `${(usualBed / WINDOW_MIN) * 100}%` }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="axis"><span /><div><span>22:00</span><span>03:00</span><span>08:00</span></div></div>
              {usualBed !== null && <p className="note"><i className="mark" /> your usual bedtime, {clock(usualBed)}</p>}
            </>
          )}
        </section>

        <section className="tile wide">
          <h2>Recent calls</h2>
          {calls.length ? (
            <ul className="calls">
              {calls.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <time>{weekdayShort(c.localDate)} {c.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: config.timeZone })}</time>
                  <span>{c.summary || "No summary."}</span>
                  <span className="meta">{c.stress ? `stress ${c.stress}` : ""} {Math.floor(c.durationS / 60)}:{String(c.durationS % 60).padStart(2, "0")}</span>
                </li>
              ))}
            </ul>
          ) : <p>No calls yet.</p>}
        </section>

        <Reminders initial={settings} />

        <section className="tile">
          <h2>Polar</h2>
          {link ? (
            <>
              <p>Connected. <a href="/dashboard/data">Raw numbers</a></p>
              <form action="/api/polar/disconnect" method="post"><button className="link-btn" id="polar-disconnect" type="submit">Disconnect Polar</button></form>
            </>
          ) : (
            <p><a href="/api/polar/connect">Connect Polar</a> to add sleep and activity to your calls.</p>
          )}
          <p className="note">Data from Polar.</p>
        </section>
      </div>

      <a className="db-call" href="/call"><i />Start check-in call</a>
    </main>
  );
}
