// Every setting lives here, read from env. Defaults are documented in .env.example.
const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k}. See .env.example.`);
  return v;
};

export const config = {
  firebaseServiceAccount: () => JSON.parse(Buffer.from(req("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf8")),
  sessionDays: Number(process.env.SESSION_DAYS ?? 14), // Firebase caps session cookies at 14 days

  polarClientId: () => req("POLAR_CLIENT_ID"),
  polarClientSecret: () => req("POLAR_CLIENT_SECRET"),
  polarRedirectUri: () => req("POLAR_REDIRECT_URI"),

  openrouterKey: () => req("OPENROUTER_API_KEY"),
  chatModel: process.env.OPENROUTER_CHAT_MODEL ?? "anthropic/claude-haiku-4.5",
  sttModel: process.env.OPENROUTER_STT_MODEL ?? "openai/gpt-4o-mini-transcribe",
  ttsModel: process.env.OPENROUTER_TTS_MODEL ?? "deepgram/aura-2",
  ttsVoice: process.env.OPENROUTER_TTS_VOICE ?? "aura-2-thalia-en",

  timeZone: process.env.APP_TIME_ZONE ?? "Europe/London", // dates on the dashboard and in call records
  activeDaySteps: Number(process.env.ACTIVE_DAY_STEPS ?? 6000), // a day counts as active at or above this

  planCheckMinSteps: Number(process.env.PLAN_CHECK_MIN_STEPS ?? 600), // steps around a planned walk that count as done
  planCheckBeforeMin: Number(process.env.PLAN_CHECK_BEFORE_MIN ?? 30),
  planCheckAfterMin: Number(process.env.PLAN_CHECK_AFTER_MIN ?? 90),
  recentCallDays: Number(process.env.RECENT_CALL_DAYS ?? 3), // past calls the AI remembers

  vapidPublicKey: () => req("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
  vapidPrivateKey: () => req("VAPID_PRIVATE_KEY"),
  vapidSubject: () => req("VAPID_SUBJECT"),
  cronSecret: () => req("CRON_SECRET"),
  defaultMorning: process.env.DEFAULT_MORNING_TIME ?? "07:30",
  defaultNudges: (process.env.DEFAULT_NUDGE_TIMES ?? "11:00,15:00").split(",").map((t) => t.trim()).filter(Boolean),
  pushLateMin: Number(process.env.PUSH_LATE_MIN ?? 60), // a push may go out up to this many minutes after its time
  nudgeMovedSteps: Number(process.env.NUDGE_MOVED_STEPS ?? 600), // skip a nudge if the Loop shows this many steps in the last hour

  findingDays: Number(process.env.FINDING_DAYS ?? 28), // how far back findings look
  shapeDays: Number(process.env.SHAPE_DAYS ?? 28), // days of per-minute step data used for day-shape findings
  firstMoveSteps: Number(process.env.FIRST_MOVE_STEPS ?? 300), // steps in 10 minutes that count as a real walk
  findingRepeatDays: Number(process.env.FINDING_REPEAT_DAYS ?? 5), // a finding isn't used again in a call within this many days

  elevenlabsKey: process.env.ELEVENLABS_API_KEY,
  elevenlabsVoice: () => req("ELEVENLABS_VOICE_ID"),
  elevenlabsModel: process.env.ELEVENLABS_MODEL ?? "eleven_v4_turbo",
};
