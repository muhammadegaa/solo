"use client";

import { useEffect, useRef, useState } from "react";
import type { Night } from "@/lib/context";
import type { PlanItem } from "@/lib/calls";
import type { Msg } from "@/lib/openrouter";

type Phase = "idle" | "thinking" | "speaking" | "listening" | "paused" | "ended" | "error";
type Turn = { stt: number; llm: number; tts: number };

const VOICE_RMS = 0.015; // above this counts as speech
const END_SILENCE_MS = 1200; // silence after speech that ends your turn
const NO_SPEECH_MS = 10000; // stop listening if you say nothing
const MAX_TURN_MS = 30000;
const GOODBYE = /\b(bye|goodbye|talk tomorrow|speak tomorrow)\b/i;

// 16 kHz mono 16-bit WAV, base64
function toWavBase64(chunks: Float32Array[], inRate: number): string {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.length; }
  const outRate = 16000;
  const ratio = inRate / outRate;
  const n = Math.floor(pcm.length / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, pcm[Math.floor(i * ratio)]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function horizon(level: number, t: number): string {
  const amp = 4 + Math.min(1, level * 12) * 26;
  const pts: string[] = [];
  for (let x = -10; x <= 403; x += 12) {
    const y = 40 + Math.sin(x / 38 + t) * amp * Math.sin((x / 393) * Math.PI);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

function SleepCard({ nights, usualH }: { nights: Night[]; usualH: number | null }) {
  const H = 12; // px per hour
  const base = 120;
  const usualY = usualH ? base - usualH * H : null;
  const last = nights[nights.length - 1];
  return (
    <div className="fl-card">
      <div className="fl-card-h"><b>Sleep, last 7 nights</b><span>hours</span></div>
      <svg viewBox="0 0 320 146" role="img" aria-label={`Sleep hours: ${nights.map((n) => n.sleepH ?? "no data").join(", ")}${usualH ? `; usual ${usualH}` : ""}`}>
        {usualY !== null && <><rect x="24" y={usualY - 3} width="292" height="6" fill="rgba(242,178,122,.2)" /><text x="0" y={usualY + 4}>usual</text></>}
        <line x1="24" y1={base} x2="316" y2={base} stroke="rgba(255,255,255,.18)" />
        {nights.map((n, i) => {
          const h = (n.sleepH ?? 0) * H;
          const isLast = i === nights.length - 1;
          const x = 30 + i * 41;
          return (
            <g key={n.date}>
              {n.sleepH !== null && <rect x={x} y={base - h} width="28" height={h} rx="7" fill={isLast ? "#f2b27a" : "rgba(246,239,230,.28)"} />}
              <text x={x + (isLast ? 0 : 10)} y="138" style={isLast ? { fill: "#f6efe6" } : undefined}>{isLast ? "Last" : "MTWTFSS"[new Date(n.date).getUTCDay() === 0 ? 6 : new Date(n.date).getUTCDay() - 1]}</text>
            </g>
          );
        })}
        {last?.sleepH !== null && last && <text x="276" y={base - (last.sleepH ?? 0) * H - 8} style={{ fill: "#f2b27a" }}>{last.sleepH} h</text>}
      </svg>
    </div>
  );
}

export default function Call({ nights, usualH, summary, findingIds, findingTitle }: { nights: Night[]; usualH: number | null; summary: string; findingIds: string[]; findingTitle: string | null }) {
  const [stress, setStress] = useState<number | null>(null);
  const stressRef = useRef<number | null>(null);
  const tapStress = (n: number) => { stressRef.current = n; setStress(n); };
  const [phase, setPhase] = useState<Phase>("idle");
  const [caption, setCaption] = useState<{ you: string | null; ai: string } | null>(null);
  const [level, setLevel] = useState(0);
  const [tick, setTick] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [cards, setCards] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: PlanItem[]; stress: number | null; error?: string } | null>(null);
  const startedAt = useRef(0);
  const turnsLog = useRef<Turn[]>([]);
  const [seconds, setSeconds] = useState(0);

  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const history = useRef<Msg[]>([]);
  const rec = useRef({ on: false, chunks: [] as Float32Array[], started: 0, spoke: false, lastVoice: 0 });
  const ended = useRef(false);

  useEffect(() => {
    if (phase === "idle" || phase === "ended" || phase === "error") return;
    const id = setInterval(() => { setTick((t) => t + 0.25); }, 50);
    const sec = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { clearInterval(id); clearInterval(sec); };
  }, [phase]);

  async function play(b64: string) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const audio = await ctx.current!.decodeAudioData(bytes.buffer);
    const src = ctx.current!.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.current!.destination);
    setPhase("speaking");
    await new Promise<void>((r) => { src.onended = () => r(); src.start(); });
  }

  async function turn(audio?: string) {
    setPhase("thinking");
    const res = await fetch("/api/call/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio, history: history.current, summary }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    if (body.userText) history.current.push({ role: "user", content: body.userText });
    history.current.push({ role: "assistant", content: body.reply });
    turnsLog.current.push(body.ms);
    setTurns((t) => [...t, body.ms]);
    setCaption({ you: body.userText, ai: body.reply });
    await play(body.audio);
    if (ended.current) return;
    if (GOODBYE.test(body.reply)) return finish();
    listen();
  }

  function listen() {
    rec.current = { on: true, chunks: [], started: Date.now(), spoke: false, lastVoice: 0 };
    setPhase("listening");
  }

  function onFrame(data: Float32Array) {
    const r = rec.current;
    if (!r.on) return;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    setLevel(rms);
    r.chunks.push(new Float32Array(data));
    const now = Date.now();
    if (rms > VOICE_RMS) { r.spoke = true; r.lastVoice = now; }
    const done = r.spoke && now - r.lastVoice > END_SILENCE_MS;
    if (done || now - r.started > MAX_TURN_MS) {
      r.on = false;
      const wav = toWavBase64(r.chunks, ctx.current!.sampleRate);
      turn(wav).catch(fail);
    } else if (!r.spoke && now - r.started > NO_SPEECH_MS) {
      r.on = false;
      setPhase("paused");
    }
  }

  function fail(e: unknown) {
    setError((e as Error).message);
    setPhase("error");
  }

  async function start() {
    try {
      ended.current = false;
      history.current = [];
      turnsLog.current = [];
      startedAt.current = Date.now();
      stressRef.current = null;
      setStress(null);
      setResult(null);
      setTurns([]);
      setSeconds(0);
      ctx.current = new AudioContext();
      await ctx.current.resume();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const src = ctx.current.createMediaStreamSource(stream.current);
      const proc = ctx.current.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => onFrame(e.inputBuffer.getChannelData(0));
      src.connect(proc);
      proc.connect(ctx.current.destination);
      await turn();
    } catch (e) { fail(e); }
  }

  function finish() {
    ended.current = true;
    rec.current.on = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close();
    setPhase("ended");
    fetch("/api/call/end", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startedAt: startedAt.current, durationS: Math.round((Date.now() - startedAt.current) / 1000), messages: history.current, turnsMs: turnsLog.current, stressTap: stressRef.current, findingIds }),
    })
      .then((r) => r.json())
      .then((b) => setResult(b.error ? { plan: [], stress: null, error: b.error } : b))
      .catch(() => setResult({ plan: [], stress: null, error: "Could not save this call." }));
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const status = { idle: "", thinking: "thinking", speaking: "speaking", listening: "listening", paused: "paused", ended: "ended", error: "error" }[phase];
  const last = turns[turns.length - 1];

  if (phase === "idle" || phase === "error") {
    return (
      <main className="fl fl-start">
        <nav className="fl-nav"><a href="/dashboard" id="to-dashboard">Dashboard</a></nav>
        <div className="fl-orb" aria-hidden="true" />
        <h1>Morning check-in</h1>
        <p>About 2 minutes. You can stop any time.</p>
        {findingTitle && <p className="fl-teaser"><span>Today</span>{findingTitle}</p>}
        {error && <p className="fl-error">Something went wrong: {error}</p>}
        <button className="fl-big" id="start-call" onClick={start}>{error ? "Try again" : "Start call"}</button>
      </main>
    );
  }

  if (phase === "ended") {
    return (
      <main className="fl fl-end">
        <p className="fl-status">Call ended · {mmss}</p>
        <h1>Today&apos;s plan</h1>
        {!result && <p className="fl-dim">Saving the call…</p>}
        {result?.error && <p className="fl-error">{result.error}</p>}
        {result && !result.error && (
          <>
            <div className="fl-card">
              <div className="fl-card-h"><b>Agreed</b></div>
              {result.plan.length ? (
                <ul className="fl-plan">{result.plan.map((p, i) => <li key={i}><time>{p.time ?? "any time"}</time><span>{p.action}</span></li>)}</ul>
              ) : <p className="fl-dim">Nothing agreed this time.</p>}
            </div>
            <div className="fl-card"><div className="fl-card-h"><b>Stress</b><span>{result.stress ? `${result.stress} of 5` : "not given"}</span></div></div>
          </>
        )}
        <div className="fl-end-actions">
          <a className="fl-big" href="/dashboard">Open dashboard</a>
          <button className="link-btn" id="again" onClick={() => setPhase("idle")}>Back</button>
        </div>
        {turns.length > 0 && <p className="fl-ms">Response time per turn: {turns.map((t) => `${((t.stt + t.llm + t.tts) / 1000).toFixed(1)} s`).join(", ")}</p>}
      </main>
    );
  }

  const speakingLevel = phase === "speaking" ? 0.05 + 0.04 * Math.abs(Math.sin(tick * 1.7)) : phase === "listening" ? level : 0.002;

  return (
    <main className="fl fl-call">
      <div className="fl-top"><span className="fl-name">Morning check-in</span><span className="fl-t">{mmss}</span></div>
      <svg className="fl-horizon" viewBox="0 0 393 80" aria-hidden="true">
        <path d="M0 40 L393 40" stroke="rgba(242,178,122,.25)" strokeWidth="1" fill="none" />
        <path d={horizon(speakingLevel, tick)} stroke={phase === "listening" ? "#f6efe6" : "#f2b27a"} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <p className="fl-status">{status}</p>
      {caption?.you && <div className="fl-cap you"><span className="fl-who">You</span><p>{caption.you}</p></div>}
      {caption && <div className="fl-cap"><span className="fl-who">Check-in</span><p>{caption.ai}</p></div>}
      {cards && nights.length > 0 && <SleepCard nights={nights} usualH={usualH} />}
      <div className="fl-card fl-stress">
        <div className="fl-card-h"><b>Stress right now</b><span>{stress ? "saved with this call" : "tap any time"}</span></div>
        <div className="fl-scale" role="group" aria-label="Stress, 1 calm to 5 very stressed">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} id={`stress-${n}`} className={stress === n ? "on" : ""} aria-pressed={stress === n} onClick={() => tapStress(n)}>{n}</button>)}
        </div>
        <div className="fl-scale-l"><span>calm</span><span>very stressed</span></div>
      </div>
      {phase === "paused" && <button className="fl-big fl-resume" id="resume" onClick={listen}>Tap to talk</button>}
      {last && <p className="fl-ms">last turn: stt {last.stt} · llm {last.llm} · tts {last.tts} ms</p>}
      <div className="fl-ctrls">
        <div className="fl-ctrl"><button id="toggle-cards" className={cards ? "on" : ""} aria-label={cards ? "Hide cards" : "Show cards"} onClick={() => setCards((c) => !c)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" rx="3" /><path d="M8 14v-3M12 14V9M16 14v-2" /></svg></button>cards</div>
        <div className="fl-ctrl"><button id="end-call" className="end" aria-label="End call" onClick={finish}>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 14.5c5-4.6 13-4.6 18 0l-2.3 2.4-3.5-1.4v-2.4a12 12 0 0 0-6.4 0v2.4l-3.5 1.4z" /></svg></button>end</div>
      </div>
    </main>
  );
}
