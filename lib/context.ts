import { getShown, recentCalls } from "./calls";
import { config } from "./config";
import { getDays, type Day } from "./days";
import { findings, pickForCall, type Finding } from "./findings";
import { checkPlans, followupLines } from "./followup";
import { getPolarLink } from "./store";
import { median } from "./week";

export type Night = { date: string; sleepH: number | null; bed: string | null };
export type CallContext = { nights: Night[]; usualH: number | null; summary: string; findingIds: string[]; finding: Finding | null };

const questionsIn = (text: string) => text.split(/(?<=[?.!])\s+/).filter((s) => s.trim().endsWith("?"));

export async function getCallContext(uid: string): Promise<CallContext> {
  const link = await getPolarLink(uid);
  const [days, calls, shown] = await Promise.all([getDays(uid, link?.accessToken ?? null), recentCalls(uid, config.recentCallDays), getShown(uid)]);
  const today = days[days.length - 1].date;
  const { finding, question } = pickForCall(findings(days), shown, today, config.findingRepeatDays);

  const withSleep = days.filter((d) => d.sleepH !== null);
  const usualH = median(withSleep.slice(-14).map((d) => d.sleepH!));
  const last: Day | undefined = days[days.length - 1].sleepH !== null ? days[days.length - 1] : undefined;
  const nights = days.slice(-7).map((d) => ({ date: d.date, sleepH: d.sleepH, bed: d.bed }));

  const lastCallQs = calls[0] ? calls[0].messages.filter((m) => m.role === "assistant").flatMap((m) => questionsIn(m.content)) : [];
  const knownFactors = [...new Set(calls.flatMap((c) => c.factors))];
  const followups = calls.length ? followupLines(await checkPlans(link?.accessToken ?? null, calls)) : [];

  const summary = [
    link ? `Last night: ${last ? `${last.sleepH} h, bed ${last.bed}, wake ${last.wake}, HRV ${last.hrv ?? "?"} ms, ANS charge ${last.ans ?? "?"}` : "not synced yet"}. Usual sleep (14-day median): ${usualH ?? "unknown"} h.` : "No wearable connected. Don't talk about sleep numbers.",
    "",
    "TODAY'S FINDING (lead with this; he can't see it in his wearable app):",
    finding ? `${finding.title}. ${finding.detail}${finding.strength === "hint" ? " (Early hint: few days so far, say so.)" : ""}${finding.suggestion ? ` Possible small action: ${finding.suggestion}.` : ""}` : "None yet. Instead, ask about one thing in his day that would help you spot patterns later (coffee, getting outside, the kids, job search).",
    "",
    "ONE QUESTION TO ASK, if it fits naturally:",
    question ? question.detail : "Ask one specific question linked to the finding or to his day.",
    "",
    knownFactors.length ? `Things he has mentioned recently: ${knownFactors.join(", ")}.` : "",
    lastCallQs.length ? `Questions you asked in the last call. Don't ask these again: ${lastCallQs.join(" | ")}` : "",
    "",
    followups.length ? `Previous calls, newest first, with what the Loop shows for each agreed action:\n${followups.join("\n")}` : "No previous calls. This is the first one.",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");

  return { nights, usualH, summary, findingIds: [finding?.id, question?.id].filter((x): x is string => Boolean(x)), finding };
}

export const systemPrompt = (summary: string) => `You are Solo, a short daily voice call with a dad who is at home most of the day, looking for work, and under stress. You know his wearable data and what he told you in past calls. Your value: tell him one thing about himself he can't see in his wearable app, then help him pick one small thing to do. No pressure.

How to talk:
- Spoken aloud: plain, warm, short. One to three sentences per turn. No lists, no markdown, no emoji.
- Use real numbers, said naturally ("about seven and a half hours", "four nights").
- Compare him only with himself. Never diagnose; never say he is stressed, ill or at risk. If a finding is an early hint, say it's early.
- Never open with "how are you feeling" or "how did you sleep". Never ask the same question as the last call.
- Don't ask for a stress rating; he taps it on screen.

Shape of the call (two to four turns, about two minutes):
1. Open with today's finding in one or two sentences. If a previous plan item is marked "looks done" or "no sign of it", mention the most recent one in a few words (no blame, never ask why).
2. Ask one specific question: the suggested one, or one tied to the finding or his day.
3. Listen. If it fits, offer one small action linked to the finding (the suggested action, made smaller after a poor night or if he sounds stretched). Fit it around anything he mentions. If he declines, that's fine.
4. Close with the agreed action, if any, in one sentence, and say goodbye.

If he says he's busy, give the finding in one sentence and end. If he says he feels low more than once, mention once that NHS talking therapies take self-referrals, then carry on gently.

What you know:
${summary}`;
