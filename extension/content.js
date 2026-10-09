// Content script: runs on every page, but only wakes up on distraction sites.
// Measures time and scroll intensity, shows the Focus Debt widget, and dims the page at the threshold.
(async () => {
  if (window.top !== window) return;

  const send = (msg) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
      } catch {
        resolve(null); // extension was reloaded; this page's script is orphaned
      }
    });

  const first = await send({ type: "check", host: location.hostname });
  if (!first || !first.tracked) return;

  // ---- Scroll intensity: pixels scrolled per second, normalised (fast, continuous = zoning out) ----
  let scrolled = 0;
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    scrolled += Math.abs(window.scrollY - lastY);
    lastY = window.scrollY;
  }, { passive: true });
  window.addEventListener("wheel", (e) => { scrolled += Math.abs(e.deltaY) * 0.5; }, { passive: true });
  window.addEventListener("touchmove", () => { scrolled += 40; }, { passive: true });

  // ---- UI (shadow DOM so the site's CSS can't touch it) ----
  const host = document.createElement("terrarium-focus-debt");
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ui-rounded, "Segoe UI", system-ui, -apple-system, sans-serif; }
      .dim {
        position: fixed; inset: 0; pointer-events: none; opacity: 0;
        background: rgba(18, 24, 20, 0.72);
        backdrop-filter: grayscale(1) blur(3px);
        transition: opacity 1.2s ease;
      }
      .dim.on { opacity: 1; pointer-events: auto; }
      .widget {
        position: fixed; right: 20px; bottom: 20px; width: 236px; pointer-events: auto;
        background: #fffaf0; color: #23322a; border-radius: 16px; padding: 14px 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,.25); border: 2px solid #cfe3cf;
        transition: all .6s cubic-bezier(.2,.8,.2,1);
      }
      .widget.min { width: 168px; padding: 10px 12px; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .title { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5a7062; font-weight: 700; }
      .label { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 99px; background: #e3f1e3; color: #2f6b3d; }
      .amount { font-size: 26px; font-weight: 800; margin: 6px 0 8px; }
      .amount small { font-size: 13px; font-weight: 600; color: #5a7062; }
      .bar { height: 8px; border-radius: 99px; background: #e9eee7; overflow: hidden; }
      .fill { height: 100%; width: 0; background: linear-gradient(90deg, #7cc48a, #e9b949); transition: width .8s ease, background .6s; }
      .demo { font-size: 10px; color: #8a6d1f; margin-top: 6px; }
      .widget.drifting { border-color: #f0d48a; }
      .widget.drifting .label { background: #fbefc8; color: #8a6312; }
      .widget.alert {
        right: 50%; bottom: 50%; transform: translate(50%, 50%); width: 380px; padding: 26px 26px 22px;
        background: #fff4f1; border-color: #e0614a; text-align: center;
      }
      .widget.alert .label { background: #fbd9d1; color: #a2321f; }
      .widget.alert .fill { background: #e0614a; }
      .widget.alert .amount { font-size: 34px; color: #a2321f; }
      .msg { display: none; font-size: 14px; line-height: 1.45; color: #4b3a35; margin: 12px 0 16px; }
      .actions { display: none; gap: 8px; flex-direction: column; }
      .widget.alert .msg, .widget.alert .actions { display: flex; }
      .widget.alert .msg { display: block; }
      button { cursor: pointer; border: 0; border-radius: 12px; font-size: 15px; font-weight: 700; padding: 12px 14px; }
      .pay { background: #2f6b3d; color: #fff; }
      .pay:hover { background: #24572f; }
      .later { background: transparent; color: #7b5f58; font-size: 13px; padding: 6px; }
      @keyframes pulse { 0%,100% { box-shadow: 0 10px 30px rgba(224,97,74,.25);} 50% { box-shadow: 0 10px 50px rgba(224,97,74,.6);} }
      .widget.alert { animation: pulse 2.4s ease-in-out infinite; }
    </style>
    <div class="dim"></div>
    <div class="widget" role="status" aria-live="polite">
      <div class="row"><span class="title">Focus Debt</span><span class="label">Calm</span></div>
      <div class="amount">0 <small>min</small></div>
      <div class="bar"><div class="fill"></div></div>
      <div class="msg"></div>
      <div class="actions">
        <button class="pay">Pay it off</button>
        <button class="later">Not yet</button>
      </div>
      <div class="demo" hidden>Demo Mode: time runs 30× faster</div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const widget = $(".widget"), dim = $(".dim");
  let locked = false;

  $(".pay").addEventListener("click", () => send({ type: locked ? "closeTab" : "payItOff" }));
  $(".later").addEventListener("click", async () => render(await send({ type: "snooze" })));

  function render(v) {
    if (!v || v.error) return;
    locked = v.locked;
    const mins = Math.floor(v.debt);
    $(".amount").innerHTML = `${mins} <small>min in debt</small>`;
    $(".label").textContent = v.label;
    $(".fill").style.width = Math.min(100, (v.debt / v.threshold) * 100) + "%";
    $(".demo").hidden = !v.demoMode;

    const alert = v.locked || (v.overThreshold && !v.snoozed);
    widget.classList.toggle("alert", alert);
    widget.classList.toggle("drifting", v.label === "Drifting");
    dim.classList.toggle("on", alert);

    $(".later").style.display = v.locked ? "none" : "";
    if (v.locked) {
      $(".msg").innerHTML = `Hard Stop. You already paid off your debt today, so this feed is closed until tomorrow.<br>See you then.`;
      $(".pay").textContent = "Close this tab";
    } else if (alert) {
      $(".msg").innerHTML = `You're <b>${mins} min</b> in debt on ${location.hostname.replace(/^www\./, "")}.<br>Trade the next 15 minutes for one small thing you'll actually remember.`;
      $(".pay").textContent = "Pay it off";
      $(".later").textContent = "Not yet";
    }
  }
  render(first);

  // ---- Tick once a second while the tab is visible ----
  setInterval(async () => {
    if (document.visibilityState !== "visible") return;
    const intensity = scrolled / 1500;
    scrolled = 0;
    render(await send({ type: "tick", dt: 1, intensity }));
  }, 1000);
})();
