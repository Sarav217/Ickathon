import {
  load, saveState, saveSettings, rollDay, isLocked, nextMidnight, debtLabel, bumpHistory, todayKey,
  DEBT_THRESHOLD, TASK_MINUTES, DEMO_TASK_SECONDS, MAX_PLANT_STAGE, DEFAULT_SITES, DEFAULT_RULES, matchRule,
} from "./lib/state.js";
import { MOODS, TIMES, HOBBIES, getTask } from "./lib/tasks.js";
import { RepCounter, EXERCISES, BONES } from "./lib/reps.js";

const app = document.getElementById("app");
const hardstop = document.getElementById("hardstop");
const $ = (s, r = document) => r.querySelector(s);

// Campfire: a small, cooperative log. Simulated friends (max 5) stand in for a backend.
const FRIENDS = [
  { who: "Maya", text: "sketched my desk for 15 min 🌿" },
  { who: "Arjun", text: "learned two guitar chords 🎸" },
  { who: "Priya", text: "went for a phone-free walk" },
  { who: "Sam", text: "wrote a 100-word story" },
  { who: "Lena", text: "stretched out my neck and back" },
];

let ctx; // {settings, state}
let timerHandle = null;
let mirrorHandle = null;
let poseStop = () => {};
let mixer = { mood: null, time: "15", hobby: null };

async function init() {
  ctx = await load();
  rollDay(ctx.state);
  seedCampfire();
  await saveState(ctx.state);
  chrome.storage.onChanged.addListener(async () => {
    if (document.hidden) return;
    const fresh = await load();
    ctx.settings = fresh.settings;
  });
  window.addEventListener("hashchange", route);
  $("#hs-demo-reset").addEventListener("click", async () => {
    ctx.state.lockedUntil = 0;
    await saveState(ctx.state);
    location.hash = "#home";
    route();
  });
  route();
}

function seedCampfire() {
  const s = ctx.state;
  if (s.campfire.some((e) => !e.you)) return;
  const now = Date.now();
  FRIENDS.slice(0, 3).forEach((f, i) => s.campfire.push({ ...f, at: now - (i + 1) * 47 * 60000 }));
}

// ---------- plants ----------
function plantSVG(stage, size = 180) {
  const pot = `<path d="M62 150 h56 l-6 34 h-44 z" fill="#c9825a"/><rect x="58" y="144" width="64" height="10" rx="4" fill="#d99870"/>`;
  const soil = `<ellipse cx="90" cy="146" rx="28" ry="4" fill="#5b3e2b"/>`;
  const stem = (h) => `<path d="M90 146 C88 ${146 - h / 2} 92 ${146 - h / 2} 90 ${146 - h}" stroke="#3f8f52" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const leaf = (x, y, r, c = "#5cb36f") => `<ellipse cx="${x}" cy="${y}" rx="15" ry="7" fill="${c}" transform="rotate(${r} ${x} ${y})"/>`;
  let body = "";
  if (stage === 0) body = `<circle cx="90" cy="142" r="5" fill="#8a6a4a"/>`;
  if (stage >= 1) body += stem(24) + leaf(80, 128, -30) + leaf(100, 124, 30);
  if (stage >= 2) body += stem(52) + leaf(78, 112, -35) + leaf(102, 106, 35) + leaf(80, 96, -25, "#6fc27f");
  if (stage >= 3) body += stem(84) + leaf(76, 92, -40) + leaf(104, 86, 40) + leaf(78, 74, -30, "#6fc27f") + leaf(103, 68, 30, "#6fc27f");
  if (stage >= 4) {
    body += `<g>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="90" cy="46" rx="7" ry="13" fill="#f2a1b5" transform="rotate(${a} 90 56) translate(0 -2)"/>`).join("")}<circle cx="90" cy="56" r="7" fill="#f6d365"/></g>`;
  }
  return `<svg class="sway" viewBox="0 0 180 190" width="${size}" height="${size}" aria-label="Plant, stage ${stage}">${pot}${soil}${body}</svg>`;
}

// ---------- routing ----------
function route() {
  clearInterval(timerHandle);
  clearInterval(mirrorHandle);
  poseStop(); poseStop = () => {};
  const cur = location.hash.slice(1).split("?")[0];
  document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === (cur === "welcome" || !cur ? "home" : cur)));
  const [name, qs] = location.hash.slice(1).split("?");
  const params = new URLSearchParams(qs || "");
  const locked = isLocked(ctx.state);
  hardstop.hidden = !(locked && name !== "done" && name !== "settings");
  if (!hardstop.hidden) return showHardStop();

  switch (name) {
    case "mixer": return renderMixer(params);
    case "task": return renderTask();
    case "done": return renderDone();
    case "settings": return renderSettings();
    case "insights": return renderInsights();
    default: return renderHome(name === "welcome");
  }
}

function showHardStop() {
  $("#hs-plant").innerHTML = plantSVG(ctx.state.plantStage, 150);
  const when = new Date(ctx.state.lockedUntil);
  $("#hs-sub").textContent = `Locked until ${when.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}. Distraction sites will remind you.`;
  $("#hs-demo-reset").hidden = !ctx.settings.demoMode;
}

function timeAgo(at) {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

// ---------- home / terrarium ----------
function renderHome(welcome) {
  const s = ctx.state;
  const label = debtLabel(s.debt);
  const t = s.history[todayKey()] || { scroll: 0 };
  app.innerHTML = `
    ${welcome ? `<div class="toast">Installed. Open Instagram, YouTube or Reddit: you'll get a 5-second pause first, then the Focus Debt widget.</div>` : ""}
    <div class="grid">
      <div class="stack">
        <section class="card">
          <div class="step-label">Your terrarium</div>
          <div class="scene">
            <div class="sun"></div><div class="cloud"></div><div class="cloud c2"></div>
            <div class="hill"></div><div class="hill b"></div>
            <div class="plantwrap">${plantSVG(s.plantStage, 200)}</div>
          </div>
          <div class="stats">
            <div class="stat"><b>${Math.floor(s.debt)}m</b><span>Focus Debt · ${label}</span></div>
            <div class="stat"><b>${s.plantStage}/${MAX_PLANT_STAGE}</b><span>Growth</span></div>
            <div class="stat"><b>${Math.round(t.scroll / 60)}m</b><span>Scrolled today</span></div>
          </div>
          <p class="sub" style="margin:14px 0">${s.plantStage >= MAX_PLANT_STAGE ? "Fully bloomed! Keep tending it." : "Every 15-minute task grows your plant."}</p>
          <div class="row"><button id="go">Pay off debt now</button></div>
          ${ctx.settings.demoMode ? `<div class="row" style="margin-top:14px">
            <button class="ghost" id="addDebt">Demo: add ${DEBT_THRESHOLD} min debt</button>
            <button class="ghost" id="resetAll">Demo: reset everything</button></div>` : ""}
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <div class="step-label">🔥 Campfire</div>
          <h2>Friends who stepped away today</h2>
          <ul class="log">
            ${s.campfire.slice().sort((a, b) => b.at - a.at).map((e) =>
              `<li class="${e.you ? "you" : ""}"><span class="who">${esc(e.you ? ctx.settings.name : e.who)}</span> ${esc(e.text)}<time>${timeAgo(e.at)}</time></li>`).join("") || `<li class="empty">Nobody yet.</li>`}
          </ul>
          <p class="fire">Up to 5 friends. No leaderboard, no streak shaming.</p>
        </section>
        <section class="card" id="mirror-card"></section>
      </div>
    </div>`;
  $("#go").onclick = () => (location.hash = "#mixer");
  if ($("#addDebt")) $("#addDebt").onclick = async () => { s.debt += DEBT_THRESHOLD; await saveState(s); renderHome(); };
  if ($("#resetAll")) $("#resetAll").onclick = async () => {
    Object.assign(s, { debt: 0, plantStage: 0, tasksDone: 0, lockedUntil: 0, campfire: [], history: {}, gatePasses: {} });
    seedCampfire(); await saveState(s); await chrome.storage.local.remove("activeTask"); renderHome();
  };
  renderMirrorCard();
}

// ---------- Focus Mirror card ----------
function renderMirrorCard() {
  const el = $("#mirror-card");
  if (!el) return;
  if (!ctx.settings.camera) {
    el.innerHTML = `<div class="step-label">📷 Focus Mirror</div><h2>See your fatigue as it builds</h2>
      <p class="sub" style="margin-bottom:14px">Optional. Uses your camera, on this device only, to notice low blink rate, yawns, long eye closure and sitting too close. Nothing is recorded or uploaded.</p>
      <a href="#settings"><button class="ghost">Set up in Settings</button></a>`;
    return;
  }
  const draw = async () => {
    const c = await chrome.runtime.sendMessage({ type: "cam-read" }).catch(() => null);
    if (!el.isConnected) return clearInterval(mirrorHandle);
    let body;
    if (!c || !c.fresh) body = `<p class="sub">${c && c.error ? `<span class="err">${esc(c.error)}</span>` : "Starting camera…"}</p>`;
    else if (!c.present) body = `<p class="sub">No face in view. Debt is paused while you're away.</p>`;
    else body = `<div class="mirror">
        <div class="m ${c.lowBlink ? "warn" : ""}"><b>${c.blinksPerMin}/min</b><span>Blink rate (healthy: 12+)</span></div>
        <div class="m ${c.drowsy ? "bad" : ""}"><b>${c.drowsy ? "Drowsy" : "Alert"}</b><span>Eyes & yawns</span></div>
        <div class="m ${c.tooClose ? "warn" : ""}"><b>${c.tooClose ? "Too close" : "Good"}</b><span>Distance</span></div>
        <div class="m"><b>On</b><span>Frames stay on-device</span></div></div>`;
    el.innerHTML = `<div class="step-label"><span class="dot ${c && c.fresh ? "" : "off"}"></span>Focus Mirror · live</div><h2>How you look right now</h2>${body}`;
  };
  draw();
  mirrorHandle = setInterval(draw, 1500);
}

// ---------- insights ----------
function renderInsights() {
  const h = ctx.state.history;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = todayKey(d);
    days.push({ k, label: d.toLocaleDateString([], { weekday: "short" }), ...(h[k] || { scroll: 0, paid: 0, tasks: 0, gateSkips: 0, items: 0, px: 0 }), today: i === 0 });
  }
  const max = Math.max(60, ...days.map((d) => d.scroll));
  const sum = (f) => days.reduce((a, d) => a + (d[f] || 0), 0);
  app.innerHTML = `
    <h1>Insights</h1><p class="sub">The last 7 days, kept only in this browser.</p>
    <div class="grid">
      <section class="card">
        <div class="step-label">Minutes on feed sites</div>
        <div class="bars">${days.map((d) => `<div class="bar"><em>${Math.round(d.scroll / 60)}</em><i class="${d.today ? "today" : ""}" style="height:${Math.max(3, (d.scroll / max) * 100)}%"></i><span>${d.label}</span></div>`).join("")}</div>
      </section>
      <section class="card">
        <div class="stats" style="grid-template-columns:1fr 1fr">
          <div class="stat"><b>${Math.round(sum("scroll") / 60)}m</b><span>Scrolled this week</span></div>
          <div class="stat"><b>${Math.round(sum("paid"))}m</b><span>Debt paid off</span></div>
          <div class="stat"><b>${sum("tasks")}</b><span>Micro-tasks done</span></div>
          <div class="stat"><b>${sum("gateSkips")}</b><span>Times you walked away at the pause</span></div>
          <div class="stat"><b>${sum("items")}</b><span>Shorts, Reels &amp; videos</span></div>
          <div class="stat"><b>${(sum("px") * 0.00026 / 1000 * 1000).toFixed(1)}m</b><span>Thumb distance scrolled</span></div>
        </div>
        <p class="sub" style="margin:16px 0 0;font-size:13px">${ctx.settings.demoMode ? "Demo Mode inflates scroll time, so these numbers are illustrative." : "Real time, measured only while a feed tab is in front."}</p>
      </section>
    </div>`;
}

// ---------- life mixer ----------
function chips(name, items, selected) {
  return `<div class="chips" data-group="${name}">${items.map((i) =>
    `<button class="chip ${i.id === selected ? "sel" : ""}" data-id="${i.id}">${i.emoji ? i.emoji + " " : ""}${i.label}</button>`).join("")}</div>`;
}

function renderMixer(params) {
  const debt = params.get("debt");
  const from = params.get("from");
  app.innerHTML = `
    <div class="card">
      ${debt ? `<span class="debt-pill">${debt} min of debt${from ? ` from ${esc(from)}` : ""}, paid off here</span>` : ""}
      <h1>Life Mixer</h1>
      <p class="sub">Three taps. We'll hand you exactly one thing to do for 15 minutes.</p>
      <div class="step-label">How are you feeling?</div>${chips("mood", MOODS, mixer.mood)}
      <div class="step-label">How much time do you have?</div>${chips("time", TIMES, mixer.time)}
      <div class="step-label">Pick a hobby</div>${chips("hobby", HOBBIES, mixer.hobby)}
      <button id="mix" ${mixer.mood && mixer.hobby ? "" : "disabled"}>Give me my task</button>
    </div>`;
  document.querySelectorAll(".chips").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    mixer[g.dataset.group] = b.dataset.id;
    renderMixer(params);
  }));
  $("#mix").onclick = async () => {
    $("#mix").disabled = true; $("#mix").textContent = "Mixing…";
    const task = await getTask(mixer, ctx.settings);
    await chrome.storage.local.set({ activeTask: { task, endsAt: null } });
    location.hash = "#task";
  };
}

// ---------- task + timer ----------
async function renderTask() {
  const { activeTask } = await chrome.storage.local.get("activeTask");
  if (!activeTask) { location.hash = "#mixer"; return; }
  const { task } = activeTask;
  if (task.verify && task.verify.type === "pose" && !activeTask.useTimer) return renderPoseTask(task);
  const total = ctx.settings.demoMode ? DEMO_TASK_SECONDS : TASK_MINUTES * 60;
  app.innerHTML = `
    <div class="grid">
      <section class="card task">
        <div class="step-label">Your 15-minute task${task.source !== "bundled" ? " · AI" : ""}</div>
        <h1>${esc(task.title)}</h1>
        <p class="why">${esc(task.why || "")}</p>
        <ol>${task.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        ${safeUrl(task.resource_url) ? `<a class="res" href="${esc(task.resource_url)}" target="_blank" rel="noopener">↗ ${esc(task.resource_label || "Open resource")}</a>` : ""}
      </section>
      <section class="card timer" id="timercard">
        <div class="step-label">Timer</div>
        <div class="clock" id="clock">${fmt(total)}</div>
        <div class="ring"><i id="ring"></i></div>
        <div id="pausedNote" class="sub" style="min-height:22px;color:#a2321f;font-weight:700"></div>
        <button id="start">Start</button>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="ghost" id="swap">Different task</button></div>
        <p class="sub" style="margin-top:12px;font-size:12px">${ctx.settings.demoMode ? `Demo Mode: timer is ${DEMO_TASK_SECONDS}s. ` : ""}The timer pauses while a feed site is the tab you're looking at, and you confirm at the end.</p>
      </section>
    </div>`;
  $("#swap").onclick = () => (location.hash = "#mixer");
  let endsAt = activeTask.endsAt;
  let onFeed = false, last = Date.now(), pausedMs = activeTask.pausedMs || 0;
  const feedCheck = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const host = tab && tab.url && /^https?:/.test(tab.url) ? new URL(tab.url).hostname.replace(/^www\./, "") : "";
      onFeed = !!host && !!matchRule(host, new URL(tab.url).pathname, ctx.settings.rules).rule;
    } catch { onFeed = false; }
  };
  const tick = async () => {
    const now = Date.now(), dt = now - last; last = now;
    if (onFeed) { endsAt += dt; pausedMs += dt; chrome.storage.local.set({ activeTask: { task, endsAt, pausedMs } }); }
    $("#pausedNote").textContent = onFeed ? "Paused: you're on a feed. Come back to keep going." : pausedMs > 3000 ? `Paused ${Math.round(pausedMs / 1000)}s on feeds so far` : "";
    const left = Math.max(0, Math.round((endsAt - now) / 1000));
    $("#clock").textContent = fmt(left);
    $("#ring").style.width = ((total - left) / total) * 100 + "%";
    if (left <= 0) { clearInterval(timerHandle); clearInterval(feedHandle); renderConfirm(task); }
  };
  let feedHandle;
  const begin = () => {
    $("#start").disabled = true; $("#start").textContent = "Focus…";
    last = Date.now();
    feedHandle = setInterval(feedCheck, 1200); feedCheck();
    timerHandle = setInterval(tick, 500); tick();
    const oldStop = poseStop; poseStop = () => { clearInterval(feedHandle); oldStop(); };
  };
  if (endsAt) begin();
  $("#start").onclick = async () => {
    endsAt = Date.now() + total * 1000;
    await chrome.storage.local.set({ activeTask: { ...activeTask, endsAt, pausedMs: 0 } });
    begin();
  };
}

function renderConfirm(task) {
  $("#timercard").innerHTML = `
    <div class="step-label">Time's up</div>
    <h2 style="font-size:24px;margin:10px 0">Did you actually do it?</h2>
    <p class="sub">Be honest. Your plant only grows from real effort, and nobody checks but you.</p>
    <div class="row" style="justify-content:center">
      <button id="yes">Yes, I did it</button><button class="ghost" id="no">Not really</button>
    </div>`;
  $("#yes").onclick = () => complete(task);
  $("#no").onclick = async () => { await chrome.storage.local.remove("activeTask"); location.hash = "#mixer"; };
}

// ---------- camera-verified exercise ----------
async function renderPoseTask(task) {
  const goal = ctx.settings.demoMode ? 3 : task.verify.reps;
  const ex = EXERCISES[task.verify.exercise];
  app.innerHTML = `
    <div class="grid">
      <section class="card task">
        <div class="step-label">Camera-checked exercise ${ex.emoji}</div>
        <h1>${esc(task.title)}</h1>
        <p class="why">${esc(task.why || "")}</p>
        <ol>${task.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
        <div class="privacy">The camera counts your reps on this device. Video is never saved or sent.</div>
      </section>
      <section class="card timer">
        <div class="step-label">Rep counter</div>
        <div class="stage"><video id="pv" playsinline muted></video><canvas id="pc"></canvas><div id="pph" class="ph">Camera is off</div></div>
        <div class="clock" id="reps">0 / ${goal}</div>
        <div class="ring"><i id="ring"></i></div>
        <div id="hint" class="sub" style="min-height:22px;font-weight:700">${esc(ex.cue)}</div>
        <button id="pstart">Start camera check</button>
        <div class="row" style="justify-content:center;margin-top:12px">
          <button class="ghost" id="ptimer">No camera? Use the timer</button><button class="ghost" id="swap">Different task</button>
        </div>
        <div id="perr"></div>
      </section>
    </div>`;
  $("#swap").onclick = () => (location.hash = "#mixer");
  $("#ptimer").onclick = async () => {
    poseStop(); poseStop = () => {};
    const { activeTask } = await chrome.storage.local.get("activeTask");
    await chrome.storage.local.set({ activeTask: { ...activeTask, useTimer: true } });
    renderTask();
  };

  $("#pstart").onclick = async () => {
    $("#pstart").disabled = true; $("#pstart").textContent = "Loading model…"; $("#perr").innerHTML = "";
    let stream, landmarker, stage = "camera";
    const describe = (e) => {
      if (e && (e.name || e.message)) return `${e.name || "Error"}${e.message ? ": " + e.message : ""}`;
      try { return String(e) || JSON.stringify(e) || "unknown error"; } catch { return "unknown error"; }
    };
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
      } catch (e1) {
        if (e1 && e1.name === "OverconstrainedError") stream = await navigator.mediaDevices.getUserMedia({ video: true });
        else throw e1;
      }
      stage = "model";
      $("#pstart").textContent = "Loading model…";
      const { PoseLandmarker, FilesetResolver } = await import("./vendor/mediapipe/vision_bundle.mjs");
      const files = await FilesetResolver.forVisionTasks(chrome.runtime.getURL("vendor/mediapipe"));
      const make = (delegate) => PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: chrome.runtime.getURL("vendor/mediapipe/pose_landmarker_lite.task"), delegate },
        runningMode: "VIDEO", numPoses: 1,
      });
      landmarker = await make("CPU"); // CPU is plenty for the lite model and the most reliable
    } catch (e) {
      console.error("Pose setup failed at", stage, e);
      stream && stream.getTracks().forEach((t) => t.stop());
      $("#pstart").disabled = false; $("#pstart").textContent = "Try again";
      const hint = stage === "camera"
        ? "Allow the camera from the camera icon in the address bar (or chrome://settings/content/camera), close other apps using it, then try again."
        : "The exercise model failed to load. Reload the extension in chrome://extensions and try again.";
      $("#perr").innerHTML = `<p class="err">Couldn't start the ${stage} (${esc(describe(e))}). ${hint} Or use the timer instead.</p>`;
      return;
    }
    const video = $("#pv"), canvas = $("#pc"), counter = new RepCounter(task.verify.exercise);
    video.srcObject = stream; await video.play();
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    $("#pph").hidden = true; $("#pstart").hidden = true;
    const g = canvas.getContext("2d");
    let stopped = false, done = false;
    poseStop = () => { if (stopped) return; stopped = true; stream.getTracks().forEach((t) => t.stop()); try { landmarker.close(); } catch {} };
    const loop = async () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        const res = landmarker.detectForVideo(video, performance.now());
        const lm = res.landmarks && res.landmarks[0];
        const st = counter.update(lm);
        g.clearRect(0, 0, canvas.width, canvas.height);
        if (lm) {
          g.strokeStyle = "#5fae73"; g.lineWidth = 4; g.fillStyle = "#fff";
          for (const [a, b] of BONES) { if ((lm[a].visibility ?? 1) > .4 && (lm[b].visibility ?? 1) > .4) { g.beginPath(); g.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height); g.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height); g.stroke(); } }
        }
        $("#reps").textContent = `${st.reps} / ${goal}`;
        $("#ring").style.width = Math.min(100, (st.reps / goal) * 100) + "%";
        $("#hint").textContent = st.hint;
        if (st.reps >= goal && !done) { done = true; poseStop(); await complete(task); return; }
      }
      setTimeout(loop, 90);
    };
    loop();
  };
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

async function complete(task) {
  const s = ctx.state;
  s.lastPaidDebt = Math.round(s.debt);
  s.debt = 0;
  s.snoozeUntilDebt = 0;
  s.tasksDone += 1;
  s.plantStage = Math.min(MAX_PLANT_STAGE, s.plantStage + 1);
  s.lastTask = task.title;
  bumpHistory(s, { paid: s.lastPaidDebt, tasks: 1 });
  s.campfire.push({ who: ctx.settings.name, you: true, at: Date.now(), text: `finished "${task.title}" ${task.verify ? "(camera-verified)" : ""} 🌱` });
  await saveState(s);
  await chrome.storage.local.remove("activeTask");
  location.hash = "#done";
}

// ---------- done → Hard Stop ----------
function confetti() {
  const box = document.createElement("div"); box.className = "confetti";
  const cols = ["#5fae73", "#e9b949", "#f2a1b5", "#7ec0e8", "#e0614a"];
  for (let i = 0; i < 48; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2 + Math.random() * 1.5}s`;
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4500);
}

function renderDone() {
  const s = ctx.state;
  confetti();
  app.innerHTML = `
    <div class="card celebrate">
      <div class="step-label">Debt paid</div>
      <h1>Your plant grew 🌱</h1>
      <div class="pot drop">${plantSVG(s.plantStage, 220)}</div>
      <p class="sub">${s.lastPaidDebt} min of Focus Debt cleared. Your friends can see it at the Campfire.</p>
      <p class="fire">Going quiet in a moment…</p>
    </div>`;
  setTimeout(async () => {
    s.lockedUntil = ctx.settings.demoMode ? Date.now() + 10 * 60000 : nextMidnight();
    await saveState(s);
    location.hash = "#home";
    route();
  }, 3500);
}

// ---------- settings ----------
let settingsUnlockedUntil = 0;
const UNLOCK_PHRASE = "I choose to unlock";

function renderSettingsLock() {
  app.innerHTML = `
    <div class="card" style="max-width:560px;margin:30px auto;text-align:center">
      <div class="step-label">Settings are locked</div>
      <h1>Not while you're ${isLocked(ctx.state) ? "on a Hard Stop" : "in debt"}.</h1>
      <p class="sub">This is when changing the rules is most tempting, so it takes a moment. Type the phrase and wait 30 seconds, or pay off your debt first.</p>
      <label class="fld" for="ph" style="text-align:left">Type: <b>${UNLOCK_PHRASE}</b></label>
      <input type="text" id="ph" autocomplete="off">
      <div class="row" style="justify-content:center;margin-top:16px"><button id="unlock" disabled>Unlock in 30s</button><a href="#mixer"><button class="ghost">Pay off debt</button></a></div>
    </div>`;
  let left = 30;
  const refresh = () => {
    const typed = $("#ph").value.trim().toLowerCase() === UNLOCK_PHRASE.toLowerCase();
    $("#unlock").disabled = !(typed && left <= 0);
    $("#unlock").textContent = left > 0 ? `Unlock in ${left}s` : typed ? "Unlock settings" : "Type the phrase";
  };
  $("#ph").oninput = refresh;
  timerHandle = setInterval(() => { left = Math.max(0, left - 1); refresh(); }, 1000);
  $("#unlock").onclick = () => { settingsUnlockedUntil = Date.now() + 5 * 60000; renderSettings(); };
}

function ruleRow(r, i) {
  const def = DEFAULT_RULES.find((d) => d.host === r.host);
  const feedOpt = def && def.paths.length
    ? `<select data-k="scope"><option value="feed" ${r.paths.length ? "selected" : ""}>Feed pages only</option><option value="all" ${r.paths.length ? "" : "selected"}>Whole site</option></select>`
    : `<span class="muted">Whole site</span>`;
  return `<div class="rule" data-i="${i}" data-host="${esc(r.host)}">
    <b>${esc(r.host)}</b>${feedOpt}
    <label class="mini">limit <input type="number" min="0" max="600" data-k="budget" value="${r.budget || 0}"> min/day</label>
    <button class="ghost x" data-k="del" aria-label="Remove ${esc(r.host)}">✕</button></div>`;
}

function renderSettings() {
  clearInterval(timerHandle);
  const risky = !ctx.settings.demoMode && (isLocked(ctx.state) || ctx.state.debt >= DEBT_THRESHOLD);
  if (risky && Date.now() > settingsUnlockedUntil) return renderSettingsLock();
  const st = ctx.settings;
  let rules = st.rules.map((r) => ({ ...r }));
  const opt = (id, title, desc, on) => `<label class="opt"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span><b>${title}</b><small>${desc}</small></span></label>`;
  app.innerHTML = `
    <h1>Settings</h1><p class="sub">Every technique is optional. Turn on what helps.</p>
    <div class="grid">
      <div class="stack">
        <section class="card">
          <h2>Where it watches</h2>
          <p class="sub" style="margin-bottom:6px;font-size:13px">"Feed pages only" leaves lectures and DMs alone: on YouTube only Shorts and the home feed count.</p>
          <div id="rules"></div>
          <div class="row" style="margin-top:12px"><input type="text" id="newhost" placeholder="Add a site, e.g. news.ycombinator.com" style="flex:1"><button class="ghost" id="addhost">Add</button></div>
          <div id="rulemsg"></div>
          <label class="fld" for="itemLimit">Daily limit on Shorts, Reels &amp; TikToks (0 = off)</label>
          <input type="number" id="itemLimit" min="0" max="500" value="${st.itemLimit}" style="width:120px;padding:10px;border-radius:12px;border:2px solid var(--line)">
        </section>
        <section class="card">
          <h2>Anti-doomscroll techniques</h2>
          ${opt("gate", "Mindful pause", "A 5-second breath and a quick \"why are you here, and for how long?\" before a feed opens.", st.gate)}
          ${opt("fade", "Colour fade", "The page slowly drains to greyscale as your Focus Debt builds, so scrolling literally gets duller.", st.fade)}
          ${opt("breaks", "20-20-20 eye breaks", "While you're drifting, a nudge every 20 minutes to look 20 feet away for 20 seconds.", st.breaks)}
          ${opt("demo", "Demo Mode", "10 min of debt in ~20 seconds, a 15-second timer and a 10-minute Hard Stop. Also switches the settings lock off.", st.demoMode)}
        </section>
        <section class="card">
          <h2>📷 Focus Mirror (camera)</h2>
          <div class="privacy"><b>Private by design.</b> Video is analysed on this device by a bundled model. Frames are never saved or sent anywhere, and only four numbers (blink rate, eyes closed, yawns, distance) are used. Chrome shows its camera indicator whenever it's on, and you can switch it off here at any time.</div>
          <div class="row"><button id="camToggle" class="${st.camera ? "danger" : ""}">${st.camera ? "Turn off camera" : "Allow camera and turn on"}</button></div>
          <div id="camMsg"></div>
          <p class="sub" style="margin:12px 0 0;font-size:13px">What it changes: low blink rate or drowsiness makes debt build faster, and debt pauses while you're not in front of the screen.</p>
        </section>
      </div>
      <div class="stack">
        <section class="card">
          <h2>You</h2>
          <label class="fld" for="name">Name on the Campfire</label><input type="text" id="name" value="${esc(st.name)}">
          <p class="sub" style="margin:10px 0 0;font-size:12.5px">Your settings (never the API key) sync across your Chrome browsers.</p>
        </section>
        <section class="card">
          <h2>Optional AI tasks</h2>
          <label class="fld" for="prov">Provider</label>
          <select id="prov">
            <option value="none" ${st.aiProvider === "none" ? "selected" : ""}>None (bundled tasks)</option>
            <option value="gemini" ${st.aiProvider === "gemini" ? "selected" : ""}>Gemini</option>
            <option value="openai" ${st.aiProvider === "openai" ? "selected" : ""}>OpenAI</option>
          </select>
          <label class="fld" for="key">API key (stored only in this browser)</label><input type="password" id="key" value="${esc(st.aiKey)}" autocomplete="off">
        </section>
        <div class="row"><button id="save">Save</button><button class="ghost" id="clear">Reset all data</button></div>
        <div id="msg"></div>
      </div>
    </div>`;

  const drawRules = () => {
    $("#rules").innerHTML = rules.map(ruleRow).join("");
  };
  drawRules();
  $("#rules").addEventListener("input", (e) => {
    const row = e.target.closest(".rule"); if (!row) return;
    const r = rules[Number(row.dataset.i)];
    if (e.target.dataset.k === "budget") r.budget = Math.max(0, Number(e.target.value) || 0);
    if (e.target.dataset.k === "scope") {
      const def = DEFAULT_RULES.find((d) => d.host === r.host);
      r.paths = e.target.value === "feed" && def ? def.paths : [];
    }
  });
  $("#rules").addEventListener("click", (e) => {
    if (e.target.dataset.k !== "del") return;
    rules.splice(Number(e.target.closest(".rule").dataset.i), 1); drawRules();
  });
  $("#addhost").onclick = () => {
    const raw = $("#newhost").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) { $("#rulemsg").innerHTML = `<p class="err">Enter a site like example.com</p>`; return; }
    if (rules.some((r) => r.host === raw)) { $("#rulemsg").innerHTML = `<p class="err">Already in the list.</p>`; return; }
    rules.push(DEFAULT_RULES.find((d) => d.host === raw) || { host: raw, paths: [], budget: 0 });
    $("#newhost").value = ""; $("#rulemsg").innerHTML = ""; drawRules();
  };

  $("#camToggle").onclick = async () => {
    const msg = $("#camMsg");
    msg.innerHTML = "";
    if (ctx.settings.camera) {
      ctx.settings.camera = false;
      await saveSettings(ctx.settings);
      await chrome.runtime.sendMessage({ type: "cam-sync" });
      return renderSettings();
    }
    try {
      // This is the moment Chrome asks for permission. The grant belongs to the extension and is remembered.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      msg.innerHTML = `<p class="err">Camera access wasn't granted (${esc(e.name)}). Allow it from the camera icon in the address bar, then try again.</p>`;
      return;
    }
    ctx.settings.camera = true;
    await saveSettings(ctx.settings);
    await chrome.runtime.sendMessage({ type: "cam-sync" });
    renderSettings();
  };

  $("#save").onclick = async () => {
    // Custom sites need that one site's permission. Ask first, while the click still counts as a gesture.
    const custom = rules.map((r) => r.host).filter((h) => !DEFAULT_SITES.includes(h));
    let denied = [];
    if (custom.length) {
      const origins = custom.flatMap((h) => [`*://${h}/*`, `*://*.${h}/*`]);
      const ok = await chrome.permissions.request({ origins }).catch(() => false);
      if (!ok) { denied = custom; rules = rules.filter((r) => !custom.includes(r.host)); }
    }
    ctx.settings = {
      ...ctx.settings,
      rules: rules.length ? rules : DEFAULT_RULES,
      itemLimit: Math.max(0, Number($("#itemLimit").value) || 0),
      demoMode: $("#demo").checked,
      gate: $("#gate").checked,
      fade: $("#fade").checked,
      breaks: $("#breaks").checked,
      name: $("#name").value.trim() || "You",
      aiProvider: $("#prov").value,
      aiKey: $("#key").value.trim(),
    };
    await saveSettings(ctx.settings);
    await chrome.runtime.sendMessage({ type: "sites-sync" });
    $("#msg").innerHTML = denied.length
      ? `<div class="toast" style="margin-top:14px;background:#fbefc8;color:#8a6312">Saved, but Chrome permission for ${esc(denied.join(", "))} wasn't granted, so those sites were removed.</div>`
      : `<div class="toast" style="margin-top:14px">Saved.</div>`;
    if (denied.length) renderSettings();
  };
  $("#clear").onclick = async () => {
    await chrome.storage.local.clear();
    ctx.settings.camera = false;
    await chrome.runtime.sendMessage({ type: "cam-sync" });
    location.hash = "#home"; location.reload();
  };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeUrl(u) { return /^https:\/\//i.test(u || ""); }

init();

// After the extension reloads itself on a code change, this page's context is dead: refresh it.
setInterval(() => { if (!chrome.runtime?.id) location.reload(); }, 1500);
