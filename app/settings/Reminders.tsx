"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/settings";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

type State = "loading" | "unsupported" | "needs-home-screen" | "blocked" | "off" | "on";

export default function Reminders({ initial }: { initial: Settings }) {
  const [state, setState] = useState<State>("loading");
  const [morning, setMorning] = useState(initial.morning);
  const [nudges, setNudges] = useState([initial.nudges[0] ?? "", initial.nudges[1] ?? ""]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(ios && !standalone ? "needs-home-screen" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, []);

  async function turnOn() {
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setState("on");
      setMsg("Notifications are on. A test notification is on its way.");
    } catch (e) {
      setMsg(`Could not turn on notifications: ${(e as Error).message}`);
    }
  }

  async function turnOff() {
    const sub = await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState("off");
    setMsg("Notifications are off on this device.");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ morning, nudges: nudges.filter(Boolean) }) });
    const body = await res.json();
    setMsg(res.ok ? "Times saved." : body.error);
  }

  return (
    <section className="tile">
      <h2>Reminders</h2>
      {state === "needs-home-screen" && <p>On iPhone, add Solo to your Home Screen first (Share, then Add to Home Screen). Open it from there to turn on notifications.</p>}
      {state === "unsupported" && <p>This browser can&apos;t receive notifications.</p>}
      {state === "blocked" && <p>Notifications are blocked. Allow them for Solo in your phone&apos;s Settings, then reload.</p>}
      {state === "off" && <button className="db-btn" id="push-on" onClick={turnOn}>Turn on notifications</button>}
      {state === "on" && <p>Notifications are on on this device. <button className="link-btn" id="push-off" onClick={turnOff}>Turn off</button></p>}
      <form className="times" onSubmit={save}>
        <label htmlFor="morning">Morning call</label>
        <input id="morning" type="time" required value={morning} onChange={(e) => setMorning(e.target.value)} />
        <label htmlFor="nudge1">Check-in</label>
        <input id="nudge1" type="time" value={nudges[0]} onChange={(e) => setNudges([e.target.value, nudges[1]])} />
        <label htmlFor="nudge2">Check-in</label>
        <input id="nudge2" type="time" value={nudges[1]} onChange={(e) => setNudges([nudges[0], e.target.value])} />
        <button className="db-btn" type="submit" id="save-times">Save times</button>
      </form>
      <p className="note">A check-in is skipped if your Loop already shows you moving in the last hour.</p>
      {msg && <p className="note">{msg}</p>}
    </section>
  );
}
