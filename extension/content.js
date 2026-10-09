// Content script: runs on every page, but only wakes up on distraction sites.
// Intent gate -> live Focus Debt widget -> greyscale fade -> dim + "Pay it off" -> Hard Stop.
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
  const siteName = location.hostname.replace(/^www\./, "");

  // ---- Scroll intensity: pixels scrolled per second, normalised (fast, continuous = zoning out) ----
  let scrolled = 0;
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => { scrolled += Math.abs(window.scrollY - lastY); lastY = window.scrollY; }, { passive: true });
  window.addEventListener("wheel", (e) => { scrolled += Math.abs(e.deltaY) * 0.5; }, { passive: true });
  window.addEventListener("touchmove", () => { scrolled += 40; }, { passive: true });

  // ---- UI (shadow DOM so the site's CSS can't touch it) ----
  const host = document.createElement("terrarium-focus-debt");
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, sans-serif; }
      .fade, .dim, .gate { position: fixed; inset: 0; pointer-events: none; }
      .fade { transition: backdrop-filter 1.5s ease; }
      .dim { opacity: 0; background: radial-gradient(circle at 50% 45%, rgba(20,34,26,.62), rgba(10,18,14,.86));
             backdrop-filter: grayscale(1) blur(6px); transition: opacity 1s ease; }
      .dim.on { opacity: 1; pointer-events: auto; }
      .gate { display: none; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 40%, #f6f1e2, #dfe9d7);
              pointer-events: auto; animation: in .5s ease; }
      .gate.on { display: flex; }
      @keyframes in { from { opacity: 0; } to { opacity: 1; } }
      .panel { width: min(440px, 92vw); text-align: center; color: #1f3026; }
      .panel h2 { font-size: 26px; margin: 18px 0 6px; letter-spacing: -.01em; }
      .panel p { margin: 0 0 14px; color: #55695c; font-size: 15px; line-height: 1.5; }
      .breath { width: 120px; height: 120px; margin: 0 auto; border-radius: 50%;
                background: radial-gradient(circle at 35% 30%, #b8e2c0, #5fae73); box-shadow: 0 0 0 0 rgba(95,174,115,.4);
                animation: breathe 5s ease-in-out infinite; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 32px; }
      @keyframes breathe { 0%,100% { transform: scale(.78); box-shadow: 0 0 0 0 rgba(95,174,115,.35);} 50% { transform: scale(1.05); box-shadow: 0 0 0 28px rgba(95,174,115,0);} }
      .chips { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 6px 0 14px; }
      .chip { background: #fff; color: #1f3026; border: 2px solid #d5e0d0; padding: 9px 14px; font-size: 14px; font-weight: 700; border-radius: 99px; }
      .chip.sel { border-color: #2f6b3d; background: #e3f1e3; color: #2f6b3d; }
      .lbl { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: #6b8072; font-weight: 800; margin: 10px 0 2px; }

      .widget { position: fixed; right: 18px; bottom: 18px; width: 232px; pointer-events: auto; color: #1f3026;
        background: rgba(255,251,242,.96); backdrop-filter: blur(10px); border-radius: 20px; padding: 12px 14px;
        box-shadow: 0 12px 36px rgba(15,30,20,.28), 0 0 0 2px rgba(255,255,255,.6) inset; border: 2px solid #cfe3cf;
        transition: transform .5s cubic-bezier(.2,.9,.2,1), width .5s, border-color .5s, opacity .3s; display: none; }
      .widget.on { display: block; animation: rise .6s cubic-bezier(.2,.9,.2,1); }
      @keyframes rise { from { transform: translateY(20px); opacity: 0; } }
      .top { display: flex; align-items: center; gap: 12px; }
      .gauge { position: relative; width: 62px; height: 62px; flex: none; }
      .gauge svg { transform: rotate(-90deg); }
      .gauge .num { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 800; font-size: 19px; }
      .meta .t { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: #6b8072; font-weight: 800; }
      .meta .l { font-size: 20px; font-weight: 800; line-height: 1.1; margin-top: 2px; }
      .meta .s { font-size: 11px; color: #6b8072; margin-top: 2px; }
      .tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 9px; }
      .tag { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 99px; background: #edf3ea; color: #3f6a4a; }
      .tag.warn { background: #fbefc8; color: #8a6312; }
      .tag.bad { background: #fbd9d1; color: #a2321f; }
      .widget.drifting { border-color: #f0d48a; }
      .widget.drained { border-color: #e0614a; }
      .widget .demo { font-size: 10px; color: #8a6d1f; margin-top: 7px; }

      .alert { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(400px, 92vw); display: none; pointer-events: auto;
        background: #fff6f3; border-radius: 26px; padding: 28px 26px 20px; text-align: center; color: #3b2a25;
        border: 2px solid #e0614a; box-shadow: 0 30px 80px rgba(0,0,0,.45); }
      .alert.on { display: block; animation: pop .55s cubic-bezier(.2,1.2,.3,1); }
      @keyframes pop { from { transform: translate(-50%, -46%) scale(.9); opacity: 0; } }
      .alert .big { font-size: 56px; font-weight: 900; color: #b73a24; line-height: 1; letter-spacing: -.03em; }
      .alert .big small { font-size: 17px; font-weight: 700; color: #7b5f58; letter-spacing: 0; margin-left: 4px; }
      .alert .pill { display: inline-block; font-size: 12px; font-weight: 800; background: #fbd9d1; color: #a2321f; padding: 4px 12px; border-radius: 99px; margin-bottom: 10px; }
      .alert p { font-size: 15px; line-height: 1.5; color: #5a443e; margin: 12px 0 18px; }
      .alert .why { font-size: 12px; color: #8a736d; margin: -6px 0 16px; }
      button { cursor: pointer; border: 0; font: inherit; font-weight: 800; border-radius: 14px; }
      .go { width: 100%; padding: 14px; font-size: 16px; background: #2f6b3d; color: #fff; box-shadow: 0 6px 0 #1f4b2a; transition: transform .1s, box-shadow .1s; }
      .go:hover { background: #377a47; }
      .go:active { transform: translateY(4px); box-shadow: 0 2px 0 #1f4b2a; }
      .go:disabled { opacity: .5; cursor: default; box-shadow: none; }
      .ghost { background: transparent; color: #7b5f58; font-size: 13px; padding: 10px; margin-top: 6px; }

      .toast { position: fixed; top: 18px; left: 50%; transform: translateX(-50%) translateY(-120px); width: min(380px, 92vw); pointer-events: auto;
        background: #fffaf0; color: #1f3026; border-radius: 18px; padding: 14px 16px; border: 2px solid #cfe3cf;
        box-shadow: 0 14px 40px rgba(0,0,0,.28); transition: transform .6s cubic-bezier(.2,.9,.2,1); display: flex; gap: 12px; align-items: center; }
      .toast.on { transform: translateX(-50%) translateY(0); }
      .toast .ic { font-size: 26px; }
      .toast b { display: block; font-size: 14px; }
      .toast span { font-size: 12.5px; color: #55695c; line-height: 1.4; }
      .toast .x { margin-left: auto; background: transparent; color: #8a9a8e; font-size: 18px; padding: 4px 8px; }
    </style>

    <div class="fade"></div>
    <div class="dim"></div>

    <div class="gate" role="dialog" aria-label="Before you scroll">
      <div class="panel">
        <div class="breath"><span id="count">5</span></div>
        <h2>Pause. What did you come here for?</h2>
        <p>Take one slow breath, then choose on purpose. <b id="gsite"></b> will still be here.</p>
        <div class="lbl">I'm here to</div>
        <div class="chips" id="purpose">
          <button class="chip" data-v="look something up">Look something up</button>
          <button class="chip" data-v="relax for a bit">Relax for a bit</button>
          <button class="chip" data-v="I'm just bored">I'm just bored</button>
        </div>
        <div class="lbl">I'll stop after</div>
        <div class="chips" id="budget">
          <button class="chip" data-v="5">5 min</button>
          <button class="chip sel" data-v="10">10 min</button>
          <button class="chip" data-v="15">15 min</button>
        </div>
        <button class="go" id="gopen" disabled>Open <span id="gname"></span></button>
        <button class="ghost" id="gleave">Actually, not now</button>
      </div>
    </div>

    <div class="widget" role="status" aria-live="polite">
      <div class="top">
        <div class="gauge">
          <svg width="62" height="62" viewBox="0 0 62 62">
            <circle cx="31" cy="31" r="26" fill="none" stroke="#e5ece0" stroke-width="7"/>
            <circle id="arc" cx="31" cy="31" r="26" fill="none" stroke="#5fae73" stroke-width="7" stroke-linecap="round"
                    stroke-dasharray="163.4" stroke-dashoffset="163.4" style="transition: stroke-dashoffset .8s ease, stroke .6s"/>
          </svg>
          <div class="num" id="num">0</div>
        </div>
        <div class="meta"><div class="t">Focus Debt</div><div class="l" id="lbl">Calm</div><div class="s" id="sub">minutes owed</div></div>
      </div>
      <div class="tags" id="tags"></div>
      <div class="demo" id="demo" hidden>Demo Mode: time runs 30× faster</div>
    </div>

    <div class="alert" role="alertdialog">
      <span class="pill" id="apill">Drained</span>
      <div class="big"><span id="anum">0</span><small>min in debt</small></div>
      <p id="amsg"></p>
      <div class="why" id="awhy"></div>
      <button class="go" id="pay">Pay it off</button>
      <button class="ghost" id="later">Not yet</button>
    </div>

    <div class="toast" role="status">
      <div class="ic" id="tic">👀</div>
      <div><b id="tt"></b><span id="tb"></span></div>
      <button class="x" id="tx" aria-label="Dismiss">×</button>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const fadeEl = $(".fade"), dim = $(".dim"), gate = $(".gate"), widget = $(".widget"), alertEl = $(".alert"), toast = $(".toast");
  const C = 163.4;
  let locked = false, lastBreak = Date.now(), toastTimer = null, tooCloseAt = 0;

  // ---- Intent gate ----
  function openGate(v) {
    $("#gsite").textContent = siteName;
    $("#gname").textContent = siteName;
    gate.classList.add("on");
    let n = v.gateSeconds || 5;
    $("#count").textContent = n;
    const t = setInterval(() => {
      n -= 1;
      $("#count").textContent = Math.max(n, 0);
      if (n <= 0) { clearInterval(t); $("#count").textContent = "✓"; $("#gopen").disabled = false; }
    }, 1000);
  }
  let purpose = "";
  $("#purpose").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    purpose = b.dataset.v;
    root.querySelectorAll("#purpose .chip").forEach((c) => c.classList.toggle("sel", c === b));
  });
  $("#budget").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    root.querySelectorAll("#budget .chip").forEach((c) => c.classList.toggle("sel", c === b));
  });
  $("#gopen").addEventListener("click", async () => {
    const minutes = Number(root.querySelector("#budget .sel")?.dataset.v || 10);
    await send({ type: "gatePass", host: location.hostname, minutes, purpose });
    gate.classList.remove("on");
    widget.classList.add("on");
    showToast("🎯", `${minutes} minutes, on purpose`, purpose ? `You're here to ${purpose}. We'll tell you when it's up.` : "We'll tell you when it's up.", 4500);
  });
  $("#gleave").addEventListener("click", () => send({ type: "gateLeave" }));

  // ---- Alert / widget ----
  $("#pay").addEventListener("click", () => send({ type: locked ? "closeTab" : "payItOff" }));
  $("#later").addEventListener("click", async () => render(await send({ type: "snooze" })));
  $("#tx").addEventListener("click", () => toast.classList.remove("on"));

  function showToast(icon, title, body, ms = 9000) {
    $("#tic").textContent = icon; $("#tt").textContent = title; $("#tb").textContent = body;
    toast.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("on"), ms);
  }

  function render(v) {
    if (!v || v.error) return;
    locked = v.locked;
    const mins = Math.floor(v.debt);
    const frac = Math.min(1, v.debt / v.threshold);
    const state = v.label.toLowerCase();

    // widget
    $("#num").textContent = mins;
    $("#lbl").textContent = v.label;
    $("#arc").style.strokeDashoffset = String(C * (1 - frac));
    $("#arc").style.stroke = state === "drained" ? "#e0614a" : state === "drifting" ? "#e9b949" : "#5fae73";
    $("#sub").textContent = state === "calm" ? "minutes owed" : state === "drifting" ? "slipping a little" : "time to pay it off";
    widget.classList.toggle("drifting", state === "drifting");
    widget.classList.toggle("drained", state === "drained");
    $("#demo").hidden = !v.demoMode;
    const tags = [];
    const cam = v.cam;
    if (cam && cam.on) {
      if (!cam.fresh) tags.push(["📷 starting…", ""]);
      else if (!cam.present) tags.push(["📷 away, debt paused", ""]);
      else {
        tags.push([`👁 ${cam.blinksPerMin}/min blinks`, cam.lowBlink ? "warn" : ""]);
        if (cam.drowsy) tags.push(["😴 drowsy", "bad"]);
        if (cam.tooClose) tags.push(["📏 too close", "warn"]);
      }
    }
    $("#tags").innerHTML = tags.map(([t, c]) => `<span class="tag ${c}">${t}</span>`).join("");

    // gradual greyscale
    const g = v.fade && v.debt > 2 ? Math.min(0.9, (v.debt - 2) / (v.threshold + 2)) : 0;
    fadeEl.style.backdropFilter = g ? `grayscale(${g.toFixed(2)})` : "none";
    fadeEl.style.webkitBackdropFilter = fadeEl.style.backdropFilter;

    // alert
    const alert = v.locked || (v.overThreshold && !v.snoozed);
    dim.classList.toggle("on", alert);
    alertEl.classList.toggle("on", alert);
    widget.style.opacity = alert ? "0" : "1";
    if (alert) {
      $("#anum").textContent = mins;
      if (v.locked) {
        $("#apill").textContent = "Hard Stop";
        $("#anum").parentElement.style.display = "none";
        $("#amsg").innerHTML = `You already paid off your debt today, so this feed is closed until tomorrow.<br>See you then. 🌙`;
        $("#awhy").textContent = "";
        $("#pay").textContent = "Close this tab";
        $("#later").style.display = "none";
      } else {
        $("#apill").textContent = "Drained";
        $("#anum").parentElement.style.display = "";
        $("#amsg").innerHTML = `You've been on <b>${siteName}</b> long enough to owe yourself.<br>Trade the next 15 minutes for one small thing you'll actually remember.`;
        const why = [];
        if (cam && cam.fresh && cam.lowBlink) why.push("blinking less than usual");
        if (cam && cam.fresh && cam.drowsy) why.push("looking drowsy");
        $("#awhy").textContent = why.length ? `Focus Mirror noticed you're ${why.join(" and ")}.` : "";
        $("#pay").textContent = "Pay it off";
        $("#later").style.display = "";
        $("#later").textContent = "Not yet";
      }
    }

    // gentle nudges (only while the full alert isn't up)
    if (!alert) {
      const every = v.demoMode ? 45000 : 20 * 60000;
      if (v.breaks && state === "drifting" && Date.now() - lastBreak > every) {
        lastBreak = Date.now();
        showToast("🌳", "20-20-20 break", "Look at something 20 feet away for 20 seconds. Your eyes will thank you.");
      }
      if (cam && cam.fresh && cam.tooClose) {
        if (Date.now() - tooCloseAt > 120000) { tooCloseAt = Date.now(); showToast("📏", "You're very close to the screen", "Lean back an arm's length."); }
      }
    }
  }

  // ---- go ----
  if (first.needsGate) {
    openGate(first);
  } else {
    widget.classList.add("on");
  }
  render(first);

  setInterval(async () => {
    if (document.visibilityState !== "visible" || gate.classList.contains("on")) return;
    const intensity = scrolled / 1500;
    scrolled = 0;
    render(await send({ type: "tick", dt: 1, intensity }));
  }, 1000);
})();
