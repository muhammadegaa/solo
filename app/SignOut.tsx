"use client";

export default function SignOut() {
  return (
    <button type="button" id="sign-out" className="link-btn" onClick={async () => { await fetch("/api/auth/session", { method: "DELETE" }); window.location.replace("/login"); }}>
      Sign out
    </button>
  );
}
