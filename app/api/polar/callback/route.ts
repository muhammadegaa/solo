import { NextRequest } from "next/server";
import { exchangeCode, registerUser } from "@/lib/polar";

const page = (body: string, status = 200) =>
  new Response(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">${body}</body>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

// Single-user setup: show the token once so it can be pasted into .env.local.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return page(`<p>Polar returned an error: ${q.get("error")}</p>`, 400);
  if (!q.get("state") || q.get("state") !== req.cookies.get("polar_state")?.value) return page("<p>State mismatch. Start again from /api/polar/connect.</p>", 400);
  const code = q.get("code");
  if (!code) return page("<p>No code in the callback.</p>", 400);

  try {
    const { access_token, x_user_id } = await exchangeCode(code);
    const status = await registerUser(access_token, x_user_id);
    return page(`
      <h1>Connected</h1>
      <p>Polar user ${x_user_id} registered (HTTP ${status}).</p>
      <p>Add this line to <code>.env.local</code>, then restart <code>npm run dev</code>:</p>
      <pre style="white-space:pre-wrap;word-break:break-all;background:#f3f3f3;padding:12px">POLAR_ACCESS_TOKEN=${access_token}</pre>
    `);
  } catch (e) {
    return page(`<p>${(e as Error).message}</p>`, 500);
  }
}
