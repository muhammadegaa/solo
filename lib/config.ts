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

  elevenlabsKey: process.env.ELEVENLABS_API_KEY,
  elevenlabsVoice: () => req("ELEVENLABS_VOICE_ID"),
  elevenlabsModel: process.env.ELEVENLABS_MODEL ?? "eleven_v4_turbo",
};
