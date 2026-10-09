// Shared state helpers for the background worker, camera worker and the Terrarium dashboard.
// Everything lives in chrome.storage.local, so no account or server is needed.

export const DEFAULT_SITES = [
  "instagram.com", "youtube.com", "reddit.com", "tiktok.com", "x.com", "twitter.com", "facebook.com",
];

// Debt is measured in "debt minutes". One real minute of calm scrolling = 1 debt minute.
export const DEBT_THRESHOLD = 10; // minutes of debt before the page dims
export const DEMO_TIME_SCALE = 30; // Demo Mode: 1 real second counts as 30 seconds (10 min debt in ~20 s)
export const TASK_MINUTES = 15;
export const DEMO_TASK_SECONDS = 15; // Demo Mode timer length
export const MAX_PLANT_STAGE = 4;

export const DEFAULT_SETTINGS = {
  demoMode: true,
  sites: DEFAULT_SITES,
  aiProvider: "none", // none | gemini | openai
  aiKey: "",
  aiModel: "",
  name: "You",
  camera: false, // opt-in, on-device Focus Mirror
  gate: true, // "what did you come here for?" pause before a feed opens
  fade: true, // page slowly drains to greyscale as debt builds
  breaks: true, // 20-20-20 eye-break nudges while Drifting
  gateSeconds: 5,
};

export const DEFAULT_STATE = {
  debt: 0, // debt minutes
  scrollSeconds: 0, // real seconds spent on distraction sites today
  day: "",
  snoozeUntilDebt: 0,
  tasksDone: 0,
  plantStage: 0,
  lockedUntil: 0, // epoch ms; Hard Stop is active while now < lockedUntil
  lastTask: null,
  lastPaidDebt: 0,
  campfire: [], // [{who, text, at, you?}]
  history: {}, // { "YYYY-MM-DD": { scroll: seconds, paid: debt minutes, tasks: n, gateSkips: n } }
  gatePasses: {}, // { host: epoch ms until which the intent gate stays open }
};

export function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nextMidnight(d = new Date()) {
  const m = new Date(d);
  m.setHours(24, 0, 0, 0);
  return m.getTime();
}

export function debtLabel(debt) {
  if (debt >= DEBT_THRESHOLD) return "Drained";
  if (debt >= DEBT_THRESHOLD / 2) return "Drifting";
  return "Calm";
}

export async function load() {
  const { settings, state } = await chrome.storage.local.get(["settings", "state"]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    state: { ...DEFAULT_STATE, ...(state || {}) },
  };
}

export async function saveState(state) {
  await chrome.storage.local.set({ state });
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export function isLocked(state, now = Date.now()) {
  return state.lockedUntil > now;
}

export function bumpHistory(state, patch) {
  const k = todayKey();
  const h = (state.history[k] ||= { scroll: 0, paid: 0, tasks: 0, gateSkips: 0 });
  for (const [key, v] of Object.entries(patch)) h[key] = (h[key] || 0) + v;
  const keys = Object.keys(state.history).sort();
  while (keys.length > 14) delete state.history[keys.shift()];
}

// Roll counters over at midnight: debt carries over (it's debt), the scroll clock and lock reset.
export function rollDay(state) {
  const today = todayKey();
  if (state.day !== today) {
    state.day = today;
    state.scrollSeconds = 0;
    state.snoozeUntilDebt = 0;
    state.gatePasses = {};
    state.campfire = (state.campfire || []).filter((e) => todayKey(new Date(e.at)) === today);
  }
  return state;
}
