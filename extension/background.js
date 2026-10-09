// Background service worker: owns the Focus Debt ledger, the intent gate, the camera worker and the tab "teleport".
import {
  DEBT_THRESHOLD, DEMO_TIME_SCALE, DEFAULT_SITES, load, saveState, rollDay, isLocked, debtLabel, bumpHistory, matchRule,
} from "./lib/state.js";
import { startDevReload } from "./dev-reload.js";

const DASHBOARD = chrome.runtime.getURL("dashboard.html");
const CAMERA_URL = "camera.html";
const ITEM_DEBT = 0.4; // debt minutes per Short / Reel / TikTok watched

// Late night makes scrolling cost more.
function nightMultiplier(d = new Date()) {
  const h = d.getHours();
  return h >= 23 || h < 5 ? 1.5 : 1;
}

// ---------- Focus Mirror (camera) ----------
async function readCam(settings) {
  if (!settings.camera) return { on: false };
  const { cam } = await chrome.storage.session.get("cam");
  if (!cam || Date.now() - cam.at > 5000) return { on: true, fresh: false, error: cam?.error };
  return {
    on: true,
    fresh: true,
    present: cam.present,
    blinksPerMin: cam.blinksPerMin,
    lowBlink: cam.present && cam.warm && cam.blinksPerMin < 8,
    drowsy: cam.present && (cam.eyesClosed || cam.yawning || cam.yawns >= 2),
    tooClose: cam.present && cam.tooClose,
  };
}

async function syncCamera() {
  const { settings } = await load();
  const has = await chrome.offscreen.hasDocument();
  if (settings.camera && !has) {
    await chrome.offscreen.createDocument({
      url: CAMERA_URL,
      reasons: ["USER_MEDIA"],
      justification: "On-device Focus Mirror: blink rate and fatigue detection. Frames are never stored or sent.",
    });
  } else if (!settings.camera && has) {
    await chrome.offscreen.closeDocument();
    await chrome.storage.session.remove("cam");
  }
}

// ---------- sites the user added beyond the defaults ----------
// Defaults are declared in the manifest. Custom sites get their content script registered here,
// but only after the user grants that one site's permission in Settings.
async function syncCustomSites() {
  const { settings } = await load();
  const wanted = settings.rules.map((r) => r.host).filter((h) => !DEFAULT_SITES.includes(h));
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const have = new Set(registered.map((s) => s.id));
  const stale = registered.filter((s) => s.id.startsWith("site-") && !wanted.includes(s.id.slice(5))).map((s) => s.id);
  if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });
  for (const host of wanted) {
    const matches = [`*://${host}/*`, `*://*.${host}/*`];
    if (have.has("site-" + host) || !(await chrome.permissions.contains({ origins: matches }))) continue;
    await chrome.scripting.registerContentScripts([{ id: "site-" + host, matches, js: ["content.js"], runAt: "document_idle", persistAcrossSessions: true }]);
  }
}

// ---------- views ----------
function budgetReason(state, settings, rule) {
  if (settings.itemLimit && state.itemsToday >= settings.itemLimit) return "items";
  if (rule && rule.budget && (state.siteSeconds[rule.host] || 0) >= rule.budget * 60) return "site";
  return "";
}

function view(state, settings, cam, hit) {
  const reason = budgetReason(state, settings, hit?.rule);
  return {
    hostTracked: !!hit?.hostRule,
    tracked: !!hit?.rule,
    needsGate: !!hit?.rule && settings.gate && !isLocked(state) && !((state.gatePasses[hit.rule.host] || 0) > Date.now()),
    gateSeconds: settings.gateSeconds,
    debt: state.debt,
    label: debtLabel(state.debt),
    threshold: DEBT_THRESHOLD,
    overBudget: reason,
    overThreshold: state.debt >= DEBT_THRESHOLD || !!reason,
    snoozed: state.debt < state.snoozeUntilDebt,
    locked: isLocked(state),
    scrollSeconds: state.scrollSeconds,
    items: state.itemsToday,
    itemLimit: settings.itemLimit,
    siteBudget: hit?.rule?.budget || 0,
    siteSeconds: hit?.rule ? state.siteSeconds[hit.rule.host] || 0 : 0,
    demoMode: settings.demoMode,
    fade: settings.fade,
    breaks: settings.breaks,
    cam,
  };
}

async function handle(msg, sender) {
  const { settings, state } = await load();
  rollDay(state);
  const hit = msg.host ? matchRule(msg.host, msg.path || "/", settings.rules) : null;

  switch (msg.type) {
    case "check": {
      await saveState(state);
      return view(state, settings, await readCam(settings), hit);
    }

    case "popup": {
      return { ...view(state, settings, await readCam(settings), null), history: state.history, plantStage: state.plantStage };
    }

    case "gatePass": {
      const host = hit?.rule?.host || msg.host.replace(/^www\./, "");
      state.gatePasses[host] = Date.now() + Math.max(1, msg.minutes) * 60000;
      state.lastIntent = { host, purpose: msg.purpose || "", minutes: msg.minutes, at: Date.now() };
      await saveState(state);
      return { ok: true };
    }

    case "gateLeave": {
      bumpHistory(state, { gateSkips: 1 });
      await saveState(state);
      if (sender.tab) await chrome.tabs.remove(sender.tab.id);
      return { ok: true };
    }

    case "tick": {
      const cam = await readCam(settings);
      if (hit?.rule) {
        // debt += seconds × (1 + scrollIntensity + camera signals) × nightMultiplier, plus a bit per Short/Reel
        const dt = Math.min(msg.dt || 1, 5);
        const scale = settings.demoMode ? DEMO_TIME_SCALE : 1;
        let intensity = Math.max(0, Math.min(1.5, msg.intensity || 0));
        if (cam.fresh) intensity += (cam.lowBlink ? 0.4 : 0) + (cam.drowsy ? 0.6 : 0);
        const lookingAway = cam.fresh && cam.present === false; // not at the screen: don't charge debt
        if (!lookingAway) {
          state.scrollSeconds += dt;
          state.siteSeconds[hit.rule.host] = (state.siteSeconds[hit.rule.host] || 0) + dt * scale;
          state.debt += (dt * scale * (1 + intensity) * nightMultiplier()) / 60;
          bumpHistory(state, { scroll: dt * scale, px: Math.round(msg.px || 0) });
        }
        if (msg.items) {
          state.itemsToday += msg.items;
          state.debt += msg.items * ITEM_DEBT * (settings.demoMode ? 2 : 1);
          bumpHistory(state, { items: msg.items });
        }
        await saveState(state);
      }
      return view(state, settings, cam, hit);
    }

    case "snooze": {
      state.snoozeUntilDebt = state.debt + 3; // "Not yet": the overlay returns after a few more debt minutes
      await saveState(state);
      return view(state, settings, await readCam(settings), hit);
    }

    case "payItOff": {
      const from = sender.tab?.url ? new URL(sender.tab.url).hostname.replace(/^www\./, "") : "";
      const url = `${DASHBOARD}#mixer?from=${encodeURIComponent(from)}&debt=${Math.round(state.debt)}`;
      await chrome.tabs.create({ url, index: sender.tab ? sender.tab.index : undefined });
      if (sender.tab) await chrome.tabs.remove(sender.tab.id);
      return { ok: true };
    }

    case "closeTab": {
      if (sender.tab) await chrome.tabs.remove(sender.tab.id);
      return { ok: true };
    }

    case "cam": {
      const { type, ...cam } = msg;
      await chrome.storage.session.set({ cam: { ...cam, at: Date.now() } });
      return { ok: true };
    }

    case "cam-error": {
      await chrome.storage.session.set({ cam: { error: msg.error, at: Date.now() } });
      return { ok: true };
    }

    case "cam-sync": {
      await syncCamera();
      return { ok: true };
    }

    case "sites-sync": {
      await syncCustomSites();
      return { ok: true };
    }

    case "cam-read": {
      return readCam(settings);
    }

    default:
      return { error: "unknown message" };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) { syncCamera().catch(() => {}); syncCustomSites().catch(() => {}); }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: DASHBOARD + "#welcome" });
  syncCustomSites().catch(() => {});
});
chrome.runtime.onStartup.addListener(() => { syncCamera().catch(() => {}); syncCustomSites().catch(() => {}); });
syncCamera().catch(() => {});

startDevReload();
