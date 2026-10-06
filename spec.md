# Daily check-in for a dad at home — Product Spec

*Generated from the phase 1 interview, 2026-10-06.*

## What it is

A phone web app (installable PWA) that checks in with you a few times a day and suggests one small, doable thing for your body or mind, sized to how last night and today are going. It uses your Polar Loop data when it has it and your own taps when it doesn't. It talks in plain words, never pushes, and goes quiet when you say you're busy.

## Update 2026-10-06: call-first, "First light" design

These decisions replace the tap-and-text interface described below where they conflict.

- **Check-ins are short voice calls** of 2–3 minutes. The morning push opens a Start call screen, and the call starts on tap. A web app cannot ring like a phone call. Typing stays available as a fallback.
- **During the call**, captions and context cards are shown: sleep for the last 7 nights against your usual, today's plan as it changes, and a stress 1–5 scale you can say or tap.
- **/dashboard** has the details: stress line, today's plan, days outside, sleep timing, the coach's note, recent calls, and raw Polar numbers.
- **Visual direction: First light.** The call screen is a dawn sky with a horizon line for the voice and large serif captions. The dashboard is light. Mockup: `designs/call-directions.html`, direction A.
- **Voice pipeline**, all through OpenRouter, one key: browser records WAV, then `/audio/transcriptions`, then `/chat/completions`, then `/audio/speech` (MP3). The call is turn-based, not live streaming. Latency per turn is **not verified**; measure it in M1.
- **Coaching (idea A)**: a human coach reviews the week and replies with a voice note. Deferred until the solo version works for you.
- **Access**: one passcode, because the deployed URL can spend OpenRouter credit.

### Build milestones
1. **M1 voice loop:** on your iPhone, from the home-screen app, tap Start call, hear the AI open the call (with your Polar sleep if connected), and speak two replies. **Pass:** 3 turns complete in standalone mode, captions match what was said, and per-turn latency is recorded.
2. **M2 plan + stress:** the call ends with an agreed plan and a stress rating saved to Supabase; /dashboard shows them.
3. **M3 pushes:** morning push and nudges at your set times.

## Audience

**v1: one user, the founder.** A dad at home most of the day, looking for work, stressed, wanting to feel better physically and mentally without pressure.

Later, if it works: job-seeking parents, people made redundant, stay-at-home parents, remote workers who rarely leave the house. Possible payers then: the person, or a career coach or outplacement firm on their behalf. Not built for in v1.

## Scope

Body and mind only: movement, sleep, stress. The job search itself stays out of the app.

## Success

- **Main metric:** your stress rating (1–5), given with each nudge reply. Daily value = mean of that day's ratings. Judged on the 4-week trend.
- Also tracked, not judged on: days you moved outside, sleep regularity (bed/wake times), days where the morning plan happened.

## Daily loop

1. **Morning push** at a time you set (default 07:30).
   - Opens a card: one plain sentence about last night against your own usual, and today's plan of one or two small actions.
   - Replies: tap buttons (*Sounds good · Slept badly · Busy today · Feeling low*) plus an optional text box.
   - The AI reads the reply and adjusts today's plan, e.g. "Slept badly" turns a 20-min walk into a 10-min walk plus a 3-min breathing break.
2. **Nudges** at fixed times you choose (default 11:00 and 15:00).
   - A nudge is skipped if synced Loop data already shows you moved since the last check.
   - Replies: *Done · Later · Skip*, plus stress 1–5.
   - Loop data reaches the API only after the phone syncs with Polar Flow, so the skip rule is best-effort.
3. **Busy today**: no more nudges until tomorrow's morning push.
4. **Weekly view** (Sunday). Your stress ratings over the week as a simple line. Days moved, and sleep regularity in words.

## Suggestions

Allowed kinds: walk outside, breathing or calm-down (1–5 min), short home workout (10–20 min, bodyweight), activity with the kids (school walk, park, play outside).

Sizing rule (v1, written by Claude, **not reviewed by a sports scientist**). Inputs: last night's sleep and Nightly Recharge against your 14-day median, the morning reply, and yesterday's stress.
- Good night and low stress: the larger option, e.g. a 30-min walk or a 15-min workout.
- Poor night or high stress: the smaller option, e.g. a 10-min walk plus breathing.

No-device mode: the same flow, sized only from taps and stress ratings.

## Never

- No streaks, no guilt wording, no red failure marks. A skipped day is just a skipped day.
- No scores on the main screen. HRV, ANS charge and sleep numbers sit behind a "details" tap.
- Silent after "Busy today".
- No medical claims. It never says you are stressed, ill or at risk as a finding. It reports your own ratings and data against your own usual. If you report feeling low repeatedly, it shows a static line pointing to NHS talking therapies (self-referral) and does nothing else.

## Platform

- Next.js (App Router) + TypeScript, deployed on Vercel.
- PWA with Web Push. On iPhone, push works only after "Add to Home Screen", iOS 16.4+.
- Scheduled pushes: a cron job. Vercel Hobby cron may be limited to once a day (**not verified**). Fallback: Supabase pg_cron or a GitHub Actions schedule.
- Data: Polar AccessLink v3. OAuth once; the token does not expire unless revoked. Sleep and Nightly Recharge are pulled from the last 28 days. Webhooks or polling are optional for v1.
- LLM: through OpenRouter, model to be chosen. Check the chosen provider's data retention and training settings (**not verified**).
- Storage: full history in Supabase (London or EU region) — replies, stress ratings, daily Loop summaries, plans.
- Single user: no sign-up. One passcode or magic link protects the app.

## Key screens

1. **Today**: last-night sentence, today's plan, reply buttons and text box.
2. **Nudge**: opened from a push. The action, Done / Later / Skip, and stress 1–5.
3. **Week**: stress line, days moved, sleep regularity in words.
4. **Details**: the raw numbers per day (sleep h, bed/wake, HRV, ANS charge, steps). Also used to verify the data against Polar Flow.
5. **Settings**: push times, connect or disconnect Polar, busy mode, delete all data.

## Data protection (UK/EU)

- Health data is special-category data. v1 has one user, who is also the controller, so this is low risk for now. Before anyone else uses it: explicit consent screen, privacy policy, deletion on disconnect (Polar licence §3.3).
- Show "Data from Polar" wherever Polar data appears (licence §3.1.5). Don't use "Polar" in the product name (§7.4).

## Deferred

- Other wearables (Oura, Garmin, Apple Health)
- Job-search features
- Expert-reviewed sizing rules (friend)
- Voice replies
- Payments and multi-user

## Unverified, check during build

- How quickly Loop data appears in the API after a sync.
- Which Nightly Recharge and sleep fields the Loop actually fills.
- Vercel cron limits on the chosen plan.
- OpenRouter provider data policy for the chosen model.
