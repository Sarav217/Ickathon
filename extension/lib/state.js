// Shared state helpers for the background worker, camera worker and the Terrarium dashboard.
// Everything lives in chrome.storage.local, so no account or server is needed.

// Rules decide WHICH parts of a site count as a feed. `paths: []` means the whole site.
// "/" matches the home page exactly; any other path matches itself and everything under it.
// So lectures on youtube.com/watch are left alone while /shorts and the home feed are tracked.
export const DEFAULT_RULES = [
  { host: "youtube.com", paths: ["/shorts", "/"], budget: 0 },
  { host: "instagram.com", paths: ["/", "/reels", "/explore"], budget: 0 },
  { host: "tiktok.com", paths: [], budget: 0 },
  { host: "reddit.com", paths: [], budget: 0 },
  { host: "x.com", paths: ["/", "/home", "/explore"], budget: 0 },
  { host: "twitter.com", paths: ["/", "/home", "/explore"], budget: 0 },
  { host: "facebook.com", paths: ["/", "/watch", "/reel"], budget: 0 },
];
export const DEFAULT_SITES = DEFAULT_RULES.map((r) => r.host);

const cleanHost = (h) => h.replace(/^www\./, "");

export function matchRule(host, path, rules) {
  host = cleanHost(host);
  const rule = rules.find((r) => host === r.host || host.endsWith("." + r.host));
  if (!rule) return { hostRule: null, rule: null };
  if (!rule.paths.length) return { hostRule: rule, rule };
  const hit = rule.paths.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/") || path.startsWith(p + "?")));
  return { hostRule: rule, rule: hit ? rule : null };
}

// Individual videos in a feed: each new one is an "item" (a Short, a Reel, a TikTok).
export function feedItemKey(path) {
  return /^\/(shorts|reels?)\/[^/]+/.test(path) || /\/video\/\d+/.test(path) ? path : "";
}

export function migrateRules(settings) {
  if (settings.rules) return settings.rules;
  if (settings.sites) return settings.sites.map((h) => DEFAULT_RULES.find((r) => r.host === h) || { host: h, paths: [], budget: 0 });
  return DEFAULT_RULES;
}

// Debt is measured in "debt minutes". One real minute of calm scrolling = 1 debt minute.
export const DEBT_THRESHOLD = 10; // minutes of debt before the page dims
export const DEMO_TIME_SCALE = 30; // Demo Mode: 1 real second counts as 30 seconds (10 min debt in ~20 s)
export const TASK_MINUTES = 15;
export const DEMO_TASK_SECONDS = 15; // Demo Mode timer length
export const MAX_PLANT_STAGE = 4;

export const DEFAULT_SETTINGS = {
  demoMode: true,
  rules: DEFAULT_RULES,
  itemLimit: 20, // Shorts / Reels / TikToks per day before the alert (0 = off)
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
  itemsToday: 0, // Shorts / Reels / TikToks watched today
  siteSeconds: {}, // { host: seconds today } (Demo Mode scales these like debt)
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
  let { settings, state } = await chrome.storage.local.get(["settings", "state"]);
  if (!settings) {
    // A fresh install on a second Chrome: pick up non-secret settings synced from the first.
    try { settings = (await chrome.storage.sync.get("settings")).settings; } catch {}
  }
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  merged.rules = migrateRules(merged);
  delete merged.sites;
  return { settings: merged, state: { ...DEFAULT_STATE, ...(state || {}) } };
}

export async function saveState(state) {
  await chrome.storage.local.set({ state });
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
  try { const { aiKey, ...shareable } = settings; await chrome.storage.sync.set({ settings: shareable }); } catch {} // the API key never syncs
}

export function isLocked(state, now = Date.now()) {
  return state.lockedUntil > now;
}

export function bumpHistory(state, patch) {
  const k = todayKey();
  const h = (state.history[k] ||= { scroll: 0, paid: 0, tasks: 0, gateSkips: 0, items: 0, px: 0 });
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
    state.itemsToday = 0;
    state.siteSeconds = {};
    state.campfire = (state.campfire || []).filter((e) => todayKey(new Date(e.at)) === today);
  }
  return state;
}
