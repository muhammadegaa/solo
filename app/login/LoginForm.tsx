"use client";

import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useState } from "react";
import { clientAuth } from "@/lib/firebase-client";

type Mode = "signin" | "create" | "reset";

const messages: Record<string, string> = {
  "auth/invalid-credential": "Email or password is wrong.",
  "auth/email-already-in-use": "This email already has an account. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/invalid-email": "That email address doesn't look right.",
};

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ error: boolean; text: string } | null>(null);

  async function startSession() {
    const auth = clientAuth();
    const idToken = await auth.currentUser!.getIdToken();
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
    await signOut(auth); // the server session cookie is the only session
    if (!res.ok) throw new Error((await res.json()).error ?? "Could not sign in.");
    window.location.replace("/call");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const auth = clientAuth();
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setNote({ error: false, text: "If that email has an account, a reset link is on its way." });
      } else if (mode === "create") {
        const { invited } = await (await fetch("/api/auth/invited", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })).json();
        if (!invited) throw new Error("This email has not been invited to Solo.");
        await createUserWithEmailAndPassword(auth, email, password);
        await startSession();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        await startSession();
      }
    } catch (err) {
      const text = err instanceof FirebaseError ? (messages[err.code] ?? "Something went wrong. Try again.") : (err as Error).message;
      setNote({ error: true, text });
    } finally {
      setBusy(false);
    }
  }

  const title = { signin: "Sign in", create: "Create your account", reset: "Reset password" }[mode];

  return (
    <form className="fl-login" onSubmit={submit}>
      <h2 className="fl-form-title">{title}</h2>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode !== "reset" && (
        <>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </>
      )}
      {note && <p className={note.error ? "fl-error" : "fl-note"}>{note.text}</p>}
      <button className="fl-big" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "reset" ? "Send reset link" : mode === "create" ? "Create account" : "Sign in"}</button>
      <div className="fl-switch">
        {mode !== "signin" && <button type="button" id="to-signin" onClick={() => setMode("signin")}>Sign in</button>}
        {mode !== "create" && <button type="button" id="to-create" onClick={() => setMode("create")}>Invited? Create an account</button>}
        {mode !== "reset" && <button type="button" id="to-reset" onClick={() => setMode("reset")}>Forgot password</button>}
      </div>
    </form>
  );
}
