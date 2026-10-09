// Dev auto-reload for unpacked installs: when you edit or `git pull` files in the extension folder,
// the extension reloads itself within a few seconds. Does nothing for store-installed copies.
const FILES = ["manifest.json", "background.js", "content.js", "camera.js", "dashboard.js", "dashboard.html", "dashboard.css", "lib/state.js", "lib/tasks.js"];

async function fingerprint() {
  const parts = await Promise.all(FILES.map(async (f) => {
    try { return await (await fetch(chrome.runtime.getURL(f), { cache: "no-store" })).text(); } catch { return ""; }
  }));
  let h = 0;
  for (const c of parts.join("\u0000")) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export function startDevReload() {
  if ("update_url" in chrome.runtime.getManifest()) return; // store install
  const check = async () => {
    const now = await fingerprint();
    const { devHash } = await chrome.storage.session.get("devHash");
    await chrome.storage.session.set({ devHash: now });
    if (devHash !== undefined && devHash !== now) chrome.runtime.reload();
  };
  // Alarms wake the service worker even after Chrome has put it to sleep (unpacked allows sub-minute periods).
  chrome.alarms.create("dev-reload", { periodInMinutes: 0.1 });
  chrome.alarms.onAlarm.addListener((a) => a.name === "dev-reload" && check());
  setInterval(check, 2000);
  check();
}
