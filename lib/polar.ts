// Polar AccessLink v3: https://www.polar.com/accesslink-api/
// Each user's token is stored in Firestore. Polar tokens do not expire unless revoked.
import { config } from "./config";

const AUTH_URL = "https://flow.polar.com/oauth2/authorization";
const TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const API_URL = "https://www.polaraccesslink.com/v3";

export function authorizeUrl(state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", config.polarClientId());
  u.searchParams.set("redirect_uri", config.polarRedirectUri());
  u.searchParams.set("scope", "accesslink.read_all");
  u.searchParams.set("state", state);
  return u.toString();
}

// The code expires in 10 minutes and must be used once; reusing it makes Polar delete all issued tokens.
export async function exchangeCode(code: string): Promise<{ access_token: string; x_user_id: number }> {
  const basic = Buffer.from(`${config.polarClientId()}:${config.polarClientSecret()}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json;charset=UTF-8",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.polarRedirectUri() }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

// Data is only readable for registered users. 409 means already registered.
export async function registerUser(token: string, memberId: string): Promise<number> {
  const res = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ "member-id": memberId }),
  });
  if (res.status !== 200 && res.status !== 409) throw new Error(`Register failed (${res.status}): ${await res.text()}`);
  return res.status;
}

// Removes this app's access to the user's data. 404 means already gone.
export async function deregisterUser(token: string, polarUserId: number): Promise<void> {
  const res = await fetch(`${API_URL}/users/${polarUserId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) throw new Error(`Deregister failed (${res.status}): ${await res.text()}`);
}

async function get<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export type Night = {
  date: string;
  sleep_start_time?: string;
  sleep_end_time?: string;
  light_sleep?: number;
  deep_sleep?: number;
  rem_sleep?: number;
  unrecognized_sleep_stage?: number;
  sleep_score?: number;
  [k: string]: unknown;
};
export type Recharge = {
  date: string;
  heart_rate_variability_avg?: number;
  heart_rate_avg?: number;
  ans_charge?: number;
  nightly_recharge_status?: number;
  [k: string]: unknown;
};
export type Activity = {
  start_time?: string;
  steps?: number;
  active_duration?: string;
  inactivity_alert_count?: number;
  [k: string]: unknown;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

// Sleep and Nightly Recharge only expose the last 28 days; activities allow a 28-day range.
export async function fetchRaw(token: string, days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  const [sleep, recharge, activities] = await Promise.all([
    get<{ nights: Night[] }>(token, "/users/sleep"),
    get<{ recharges: Recharge[] }>(token, "/users/nightly-recharge"),
    get<Activity[]>(token, `/users/activities?from=${isoDate(from)}&to=${isoDate(to)}`),
  ]);
  return { nights: sleep?.nights ?? [], recharges: recharge?.recharges ?? [], activities: activities ?? [], from, to };
}

export type DayRow = {
  date: string;
  bed: string | null;
  wake: string | null;
  sleepH: number | null;
  sleepScore: number | null;
  hrv: number | null;
  ansCharge: number | null;
  steps: number | null;
  active: string | null;
  inactivityAlerts: number | null;
};

// Times are sliced from the ISO string so they stay in the device's local time.
const hhmm = (iso?: string) => (iso && iso.length >= 16 ? iso.slice(11, 16) : null);

const sleepHours = (n: Night) => {
  const s = [n.light_sleep, n.deep_sleep, n.rem_sleep, n.unrecognized_sleep_stage].filter((x): x is number => typeof x === "number");
  const sec = s.reduce((a, b) => a + b, 0);
  return sec > 0 ? Math.round((sec / 3600) * 10) / 10 : null;
};

export function toRows(raw: Awaited<ReturnType<typeof fetchRaw>>, days: number): DayRow[] {
  const nights = new Map(raw.nights.map((n) => [n.date, n]));
  const recharges = new Map(raw.recharges.map((r) => [r.date, r]));
  const acts = new Map(raw.activities.filter((a) => a.start_time).map((a) => [a.start_time!.slice(0, 10), a]));
  const rows: DayRow[] = [];
  for (let i = 0; i < days; i++) {
    const date = isoDate(new Date(raw.to.getTime() - i * 86_400_000));
    const n = nights.get(date);
    const r = recharges.get(date);
    const a = acts.get(date);
    rows.push({
      date,
      bed: hhmm(n?.sleep_start_time),
      wake: hhmm(n?.sleep_end_time),
      sleepH: n ? sleepHours(n) : null,
      sleepScore: n?.sleep_score ?? null,
      hrv: r?.heart_rate_variability_avg ?? null,
      ansCharge: r?.ans_charge ?? null,
      steps: a?.steps ?? null,
      active: a?.active_duration ? a.active_duration.replace(/^PT/, "").toLowerCase() : null,
      inactivityAlerts: a?.inactivity_alert_count ?? null,
    });
  }
  return rows;
}

// Per-minute steps for one day, in the device's local time. syncedTo is the last minute Polar has.
export type DaySteps = { total: number; samples: { min: number; steps: number }[]; syncedTo: number | null };

export async function fetchDaySteps(token: string, date: string): Promise<DaySteps | null> {
  const day = await get<{ steps?: number; samples?: { steps?: { samples?: { steps: number; timestamp: string }[] } } }>(token, `/users/activities/${date}?steps=true`);
  if (!day) return null;
  const samples = (day.samples?.steps?.samples ?? []).map((s) => ({ min: Number(s.timestamp.slice(11, 13)) * 60 + Number(s.timestamp.slice(14, 16)), steps: s.steps }));
  return { total: day.steps ?? 0, samples, syncedTo: samples.length ? samples[samples.length - 1].min : null };
}
