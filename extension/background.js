// Background service worker: owns the Focus Debt ledger and the tab "teleport".
import {
  DEBT_THRESHOLD,
  DEMO_TIME_SCALE,
  load,
  saveState,
  rollDay,
  isLocked,
  debtLabel,
} from "./lib/state.js";
import { startDevReload } from "./dev-reload.js";

const DASHBOARD = chrome.runtime.getURL("dashboard.html");

function hostMatches(host, sites) {
  host = host.replace(/^www\./, "");
  return sites.some((s) => host === s || host.endsWith("." + s));
}

// Late night makes scrolling cost more.
function nightMultiplier(d = new Date()) {
  const h = d.getHours();
  return h >= 23 || h < 5 ? 1.5 : 1;
}

function view(state, settings) {
  return {
    debt: state.debt,
    label: debtLabel(state.debt),
    threshold: DEBT_THRESHOLD,
    overThreshold: state.debt >= DEBT_THRESHOLD,
    snoozed: state.debt < state.snoozeUntilDebt,
    locked: isLocked(state),
    scrollSeconds: state.scrollSeconds,
    demoMode: settings.demoMode,
  };
}

async function handle(msg, sender) {
  const { settings, state } = await load();
  rollDay(state);

  switch (msg.type) {
    case "check": {
      const tracked = hostMatches(msg.host, settings.sites);
      await saveState(state);
      return { tracked, ...view(state, settings) };
    }

    case "tick": {
      // debt += seconds × (1 + scrollIntensity) × nightMultiplier
      const dt = Math.min(msg.dt || 1, 5);
      const scale = settings.demoMode ? DEMO_TIME_SCALE : 1;
      const intensity = Math.max(0, Math.min(1.5, msg.intensity || 0));
      state.scrollSeconds += dt;
      state.debt += (dt * scale * (1 + intensity) * nightMultiplier()) / 60;
      await saveState(state);
      return view(state, settings);
    }

    case "snooze": {
      // "Not yet": the overlay comes back after a few more debt minutes.
      state.snoozeUntilDebt = state.debt + 3;
      await saveState(state);
      return view(state, settings);
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

    default:
      return { error: "unknown message" };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: DASHBOARD }));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: DASHBOARD + "#welcome" });
});

startDevReload();
