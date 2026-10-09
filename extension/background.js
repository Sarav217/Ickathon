// Background service worker: owns the Focus Debt ledger, the intent gate, the camera worker and the tab "teleport".
import {
  DEBT_THRESHOLD, DEMO_TIME_SCALE, load, saveState, rollDay, isLocked, debtLabel, bumpHistory,
} from "./lib/state.js";
import { startDevReload } from "./dev-reload.js";

const DASHBOARD = chrome.runtime.getURL("dashboard.html");
const CAMERA_URL = "camera.html";

function hostMatches(host, sites) {
  host = host.replace(/^www\./, "");
  return sites.some((s) => host === s || host.endsWith("." + s));
}

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

// ---------- views ----------
function view(state, settings, cam) {
  return {
    debt: state.debt,
    label: debtLabel(state.debt),
    threshold: DEBT_THRESHOLD,
    overThreshold: state.debt >= DEBT_THRESHOLD,
    snoozed: state.debt < state.snoozeUntilDebt,
    locked: isLocked(state),
    scrollSeconds: state.scrollSeconds,
    demoMode: settings.demoMode,
    fade: settings.fade,
    breaks: settings.breaks,
    cam,
  };
}

async function handle(msg, sender) {
  const { settings, state } = await load();
  rollDay(state);

  switch (msg.type) {
    case "check": {
      const tracked = hostMatches(msg.host, settings.sites);
      const host = msg.host.replace(/^www\./, "");
      const locked = isLocked(state);
      const needsGate = tracked && settings.gate && !locked && !((state.gatePasses[host] || 0) > Date.now());
      await saveState(state);
      return { tracked, needsGate, gateSeconds: settings.gateSeconds, ...view(state, settings, await readCam(settings)) };
    }

    case "gatePass": {
      const host = msg.host.replace(/^www\./, "");
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
      // debt += seconds × (1 + scrollIntensity + camera signals) × nightMultiplier
      const cam = await readCam(settings);
      const dt = Math.min(msg.dt || 1, 5);
      const scale = settings.demoMode ? DEMO_TIME_SCALE : 1;
      let intensity = Math.max(0, Math.min(1.5, msg.intensity || 0));
      if (cam.fresh) intensity += (cam.lowBlink ? 0.4 : 0) + (cam.drowsy ? 0.6 : 0);
      const lookingAway = cam.fresh && cam.present === false; // not at the screen: don't charge debt
      if (!lookingAway) {
        state.scrollSeconds += dt;
        state.debt += (dt * scale * (1 + intensity) * nightMultiplier()) / 60;
        bumpHistory(state, { scroll: dt * scale });
      }
      await saveState(state);
      return view(state, settings, cam);
    }

    case "snooze": {
      state.snoozeUntilDebt = state.debt + 3; // "Not yet": the overlay returns after a few more debt minutes
      await saveState(state);
      return view(state, settings, await readCam(settings));
    }

    case "payItOff": {
      const from = sender.tab ? new URL(sender.tab.url).hostname.replace(/^www\./, "") : "";
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
  if (area === "local" && changes.settings) syncCamera().catch(() => {});
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: DASHBOARD }));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: DASHBOARD + "#welcome" });
});
chrome.runtime.onStartup.addListener(() => syncCamera().catch(() => {}));
syncCamera().catch(() => {});

startDevReload();
